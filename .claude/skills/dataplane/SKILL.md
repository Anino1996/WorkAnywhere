---
name: dataplane
description: Connect to a WorkAnywhere DataPlane agent and perform file system operations. Use when the user wants to read, write, delete, or list files on a running workspace agent, or check agent health.
disable-model-invocation: true
allowed-tools: Bash
argument-hint: [host]
---

## Setup

If `$ARGUMENTS` was provided, use it as the host. Otherwise ask:

> "What is the DataPlane host? (e.g. `http://localhost:8081`)"

Then ask:

> "What is the AGENT_TOKEN?"

Store both as `HOST` and `TOKEN` for all operations in this session. Do not ask again unless the user requests a reconnect.

Verify the connection:

```bash
curl -s -o /dev/null -w "%{http_code}" $HOST/healthz
```

If the response is not `200`, report the error and stop. If it is `200`, confirm connected and check readiness:

```bash
curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $TOKEN" $HOST/readyz
```

Report whether the agent is live and ready, then immediately run a workspace scan.

---

## Workspace scan

List the root workspace directory:

```bash
curl -s -H "Authorization: Bearer $TOKEN" $HOST/v1/dirs/ | jq .
```

Display the entries as a table. Then, based on what is present, read key files to identify the language and framework in use. Use this logic:

- `go.mod` present → read it: `curl -s -H "Authorization: Bearer $TOKEN" $HOST/v1/fs/go.mod` — report the module name and Go version
- `package.json` present → read it — report the project name, and whether it uses React, Next.js, Vue, etc. based on the `dependencies`/`devDependencies` fields
- `requirements.txt` or `pyproject.toml` present → read it — report Python and identify Django, FastAPI, Flask, etc.
- `Cargo.toml` present → read it — report the crate name and Rust edition
- `pom.xml` or `build.gradle` present → report Java/Kotlin and the build tool
- Multiple indicator files → report all detected languages/frameworks

If the workspace is empty, say so clearly.

Summarise the workspace in one short paragraph: what language/framework, what the project appears to be, and any notable top-level structure (e.g. monorepo, src layout, test directories). Then offer the operations below.

---

## Operations

### List directory

Ask the user for the path, then run:

```bash
curl -s -H "Authorization: Bearer $TOKEN" $HOST/v1/dirs/$PATH | jq .
```

Display results as a table: name, type, size, modified_at.

---

### Read file

Ask the user for the path, then run:

```bash
curl -s -D - -H "Authorization: Bearer $TOKEN" $HOST/v1/fs/$PATH
```

Print the `ETag` from the response headers. If the body is text, print it. If binary, note that the file is binary and skip printing the body.

---

### Write file

Ask the user for the path and whether they want to provide inline content or a local file path.

**Inline content:**

```bash
curl -s -D - -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-raw '$CONTENT' \
  $HOST/v1/fs/$PATH
```

**From a local file:**

```bash
curl -s -D - -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @$LOCAL_PATH \
  $HOST/v1/fs/$PATH
```

**With an ETag guard (compare-and-swap):** Ask whether they have an ETag to guard against concurrent writes:

```bash
curl -s -D - -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "If-Match: $ETAG" \
  -H "Content-Type: application/octet-stream" \
  --data-raw '$CONTENT' \
  $HOST/v1/fs/$PATH
```

After a successful write, print the new `ETag` header and `X-File-Size` header.

---

### Delete file

Ask the user for the path, then run:

```bash
curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  $HOST/v1/fs/$PATH
```

Report the result. `204` means deleted. `404` means the file did not exist.

---

## Error handling

Check the HTTP status on every response before presenting results:

| Status | Action |
|---|---|
| `200` / `201` / `204` | Success — proceed normally |
| `401` | Token is missing or invalid — ask the user to re-enter the AGENT_TOKEN |
| `403` | Path traversal detected — the path escapes the workspace root |
| `404` | File or directory not found |
| `412` | ETag mismatch — the file changed since the last read; fetch the current ETag and ask the user how to proceed |
| `500` | Agent-side error — print the error body |

Always print the `request_id` from the error response body when an error occurs.
