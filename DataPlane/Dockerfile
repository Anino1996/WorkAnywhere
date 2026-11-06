FROM golang:1.25-alpine AS builder
WORKDIR /build
COPY src/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o agent .

FROM ubuntu:24.04
RUN mkdir -p /root/.workanywhere /workspace
COPY --from=builder /build/agent /root/.workanywhere/agent
WORKDIR /workspace
EXPOSE 8081
ENTRYPOINT ["/root/.workanywhere/agent"]
