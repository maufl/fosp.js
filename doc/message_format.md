Message format
=============

    Message formait
    REQUEST := REQUEST_TYPE + " " + RESOURCE_IDENTIFIER + " " + SEQUENCE_NUMBER\r\n
               HEADERS\r\n
               \r\n
               BODY
    REQUEST_TYPE := CONNECT || AUTHENTICATE || REGISTER || CREATE || UPDATE || DELETE || SELECT
   
    RESPONSE := RESPONSE_TYPE + " " + RESONSE_STATUS + " " SEQUENCE_NUMBER\r\n
                HEADERS\r\n
                \r\n
                BODY
    RESPONSE_TYPE := SUCCEDED || FAILED
   
    NOTIFICATION := EVENT_TYPE + " " + RESOURCE_IDENTIFIER\r\n
                    HEADERS\r\n
                    \r\n
                    BODY
    EVENT_TYPE := CREATED || UPDATED || DELETED
   
    RESOURCE_IDENTIFIER := USERNAME + "@" + DOMAIN + PATH
    USERNAME := [a-z][a-z0-9_\-.]*
    DOMAIN := DOMAIN_PART ( + "." + DOMAIN_PART)*
    DOMAIN_PART := [a-z][a-z0-9_\-+]*
    PATH := (/ + PATH_FRAGMENT)*
    PATH_FRAGMENT := [a-z][a-z0-9\-_+]*
   
    HEADERS := "" || (HEADER\r\n
                     HEADERS)
    HEADER  := HEADER_KEY + ": " + HEADER_VALUE
    HEADER_KEY := [A-Z] + [a-zA-Z\-_]*
    HEADER_VALUE := [A-Z] + [a-zA-Z\-_/]*
