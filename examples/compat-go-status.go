package main

import "net/http"

func statusLabel(code int) string {
    if code >= http.StatusBadRequest {
        return "error"
    }
    return "ok"
}

var compatibilityStatus = statusLabel(202)
