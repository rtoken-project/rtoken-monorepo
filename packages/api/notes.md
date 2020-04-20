"/interestSent": {
  "get": {
    "tags": ["general"],
    "summary": "Get outgoing interest",
    "description": "Returns where all accounts which the owner is sending interest to",
    "operationId": "getOutgoingInterest",
    "produces": ["application/json"],
    "parameters": [
      {
        "name": "from",
        "in": "query",
        "description": "Address of the sender",
        "required": true,
        "type": "string"
      },
      {
        "name": "to",
        "in": "query",
        "description": "Address of the recipient",
        "required": true,
        "type": "string"
      }
    ],
    "responses": {
      "200": {
        "description": "successful operation",
        "schema": {
          "type": "string"
        }
      },
      "500": {
        "description": "Internal Error"
      }
    }
  }
}
