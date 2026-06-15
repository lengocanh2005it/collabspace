#!/usr/bin/env bash
curl -sS -w "\nHTTP:%{http_code}\n" -X POST http://127.0.0.1/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"email":"lengocanhpyne363+collabtest@gmail.com","otp":"017590"}'
