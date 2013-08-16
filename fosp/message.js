// Everything message related

/* Message format
 * REQUEST := REQUEST_TYPE + " " + RESOURCE_IDENTIFIER + " " + SEQUENCE_NUMBER\r\n
 *            HEADERS\r\n
 *            \r\n
 *            BODY
 * REQUEST_TYPE := CONNECT || AUTHENTICATE || REGISTER || CREATE || UPDATE || DELETE || SELECT
 *
 * RESPONSE := RESPONSE_TYPE + " " + RESONSE_STATUS + " " SEQUENCE_NUMBER\r\n
 *             HEADERS\r\n
 *             \r\n
 *             BODY
 * RESPONSE_TYPE := SUCCEDED || FAILED
 *
 * NOTIFICATION := EVENT_TYPE + " " + RESOURCE_IDENTIFIER\r\n
 *                 HEADERS\r\n
 *                 \r\n
 *                 BODY
 * EVENT_TYPE := CREATED || UPDATED || DELETED
 *
 * RESOURCE_IDENTIFIER := USERNAME + "@" + DOMAIN + PATH
 * USERNAME := [a-z][a-z0-9_\-.]*
 * DOMAIN := DOMAIN_PART ( + "." + DOMAIN_PART)*
 * DOMAIN_PART := [a-z][a-z0-9_\-+]*
 * PATH := (/ + PATH_FRAGMENT)*
 * PATH_FRAGMENT := [a-z][a-z0-9\-_+]*
 *
 * HEADERS := "" || (HEADER\r\n
 *                  HEADERS)
 * HEADER  := HEADER_KEY + ": " + HEADER_VALUE
 * HEADER_KEY := [A-Z] + [a-zA-Z\-_]*
 * HEADER_VALUE := [A-Z] + [a-zA-Z\-_/]*
 */

var REQUESTS = ["CONNECT", "AUTHENTICATE", "REGISTER", "CREATE", "UPDATE", "DELETE", "SELECT", "LIST"];
var RESPONSES = ["SUCCEDED", "FAILED"];
var EVENTS = ["CREATED", "UPDATED", "DELETED"];
var REQUEST = 1;
var RESPONSE = 2;
var NOTIFICATION = 3;


// Actuall message class definition

var Message = function() {
}

Message.REQUESTS = REQUESTS;
Message.RESPONSES = RESPONSES;
Message.EVENTS = EVENTS;
Message.REQUEST = REQUEST;
Message.RESPONSE = RESPONSE;
Message.NOTIFICATION = NOTIFICATION;


Message.prototype.toString = function() {
  return this.short() + ' :: ' + JSON.stringify(this.body);
}

var log = function(text) {
  console.log('fosp/message: ' + text);
};

module.exports = Message;
