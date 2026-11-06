package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/workanywhere/dataplane/internal/router"
)

func main() {
	port := os.Getenv("PORT")

	if port == "" {
		port = "8081"
	}

	root := os.Getenv("WORKSPACE_ROOT")

	if root == "" {
		root = "/workspace"
	}

	token := os.Getenv("AGENT_TOKEN")

	if token == "" {
		log.Fatal("AGENT_TOKEN is required")
	}

	addr := fmt.Sprintf(":%s", port)
	log.Printf("dataplane listening on %s", addr)

	if err := http.ListenAndServe(addr, router.New(root, token)); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
