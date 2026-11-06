package models

import (
	"encoding/json"
	"net/http"
)

type ErrorResponse struct {
	Error struct {
		Code      string `json:"code"`
		Message   string `json:"message"`
		RequestID string `json:"request_id"`
	} `json:"error"`
}

func WriteError(w http.ResponseWriter, status int, code, message, requestID string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	resp := ErrorResponse{}
	resp.Error.Code = code
	resp.Error.Message = message
	resp.Error.RequestID = requestID
	_ = json.NewEncoder(w).Encode(resp)
}
