// Bidirectional Json Storage Protocol
var REQUESTS = ["CONNECT", "AUTHENTICATE", "CREATE", "UPDATE", "DELETE", "SELECT", "LIST"];
var RESPONSES = ["SUCCEDED", "FAILED"];
var EVENTS = ["CREATED", "UPDATED", "DELETED"];
var REQUEST = 1;
var RESPONSE = 2;
var NOTIFICATION = 3;

var URI = function(string) {
	var self = this;
  var i = string.indexOf("/");
  if (i === -1)
    i = string.length;
	self.user = string.substr(0, i);
	self.path = string.substr(i, string.length);
  if (self.path === '')
    self.path = '/';

	if (! self.user.match(/^[a-zA-Z0-9_\-.]+@[a-zA-Z0-9_\-.]+$/)) {
    console.log('Invalid user: ' + self.user);
		throw new Error("Invalid user");
	}
	i = self.user.indexOf("@");
	self.user = { name: self.user.substr(0, i), domain: self.user.substr(i + 1, self.user.length) };
};

URI.prototype.toString = function() {
	return this.user.name + "@" + this.user.domain + this.path;
}
URI.prototype.fqUser = function() {
  return this.user.name + "@" + this.user.domain;
}

/* Message format
 * REQUEST := REQUEST_TYPE + " " + RESOURCE_IDENTIFIER + " " + SEQUENCE_NUMBER\r\n
 *            HEADERS\r\n
 *            \r\n
 *            BODY
 * REQUEST_TYPE := CONNECT || AUTHENTICATE || CREATE || UPDATE || DELETE || SELECT
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

// Message serialization and parsing
var parseMessage = function(raw) {
  log('Parsing message');
  log(raw);
	var message = {type: null, seq: null, request: null, response: null, event: null, uri: null, status: null, headers: {}, body: null};
	var lines = raw.split("\r\n");
	var main_line = lines.shift();
	var main = main_line.split(" ");

  // Identify the typ of the message
  var identifier = main[0];
  log('Identifier is ' + identifier);
	if (REQUESTS.indexOf(identifier) >= 0) {
    message.type = REQUEST;
		message.request = identifier;
	} else if (RESPONSES.indexOf(identifier) >= 0) {
    message.type = RESPONSE;
    message.response = identifier;
  } else if (EVENTS.indexOf(identifier) >= 0) {
    message.type = NOTIFICATION;
    message.event = identifier;
  } else {
		throw new Error("Type of message unknown: " + identifier);
	}

  // Read the URI
	if ((message.type == REQUEST || message.type == NOTIFICATION) && main.length >= 2) {
		message.uri = new URI(main[1]);
	}

  // Read the status code
  if (message.type == RESPONSE && main.length >= 2) {
    message.status = main[1];
  }

  // Read sequence number
  if ((message.type == REQUEST || message.type == RESPONSE) && main.length == 3) {
    if (typeof main[2] === 'string')
      message.seq = parseInt(main[2], 10);
    else
      message.seq = main[2];
  }

  // Read headers
	var tmp = lines.shift();
	while (typeof(tmp) === "string" && tmp != "") {
		var header = tmp.split(": ");
		if (header.length === 2) {
			message.headers[header[0]] = header[1];
		}
		else {
			throw new Error("Bad header format");
		}
		tmp = lines.shift();
	}

  // Read body
	if (lines instanceof Array && lines.length > 0) {
		var body = lines.join("\n");
		try {
			message.body = JSON.parse(body);
		}
		catch(e) {
      message.body = body;
		}
	}

	return message;
};

var serializeMessage = function(msg) {
  log("Serializing message");
  log(JSON.stringify(msg));
  // Sanity check of message
  if (msg.type !== REQUEST && msg.type !== RESPONSE && msg.type !== NOTIFICATION) {
    throw new Error("Unknown type of message: " + msg.type);
  }
  if (msg.type == REQUEST) {
    if (typeof(msg.request) !== "string" || REQUESTS.indexOf(msg.request) < 0) {
      throw new Error("Unknown request: " + msg.request);
    }
  }
  if (msg.type == RESPONSE) {
    if (typeof(msg.response) !== "string" || RESPONSES.indexOf(msg.response) < 0) {
      throw new Error("Unknown response" + msg.response);
    }
    if (typeof(msg.status) !== "number" || msg.status <= 0) {
      throw new Error("Unknown response status");
    }
  }
  if (msg.type == NOTIFICATION) {
    if (typeof(msg.event) !== "string" || EVENTS.indexOf(msg.event) < 0) {
      throw new Error("Unknown event");
    }
  }
  if (msg.type == REQUEST || msg.type === NOTIFICATION) {
    if (typeof(msg.uri) === "string" && msg.uri.length === 0 || typeof(msg.uri) === "object" && msg.uri.toString().length === 0) {
      throw new Error("Missing request uri");
    }
  }
  if ((msg.type == REQUEST || msg.type === RESPONSE) && msg.seq === null) {
    throw new Error("Missing request sequence number");
  }
  if (typeof(msg.headers) === 'undefined') {
    msg.headers = {};
  }
	if (typeof(msg.headers) !== 'object') {
		throw new Error("Invalid headers object");
	}
	var raw = "";
  if (msg.type === REQUEST) {
    raw += [msg.request, msg.uri, msg.seq].join(" ");
  }
  else if (msg.type === RESPONSE) {
    raw += [msg.response, msg.status, msg.seq].join(" ");
  }
  else if (msg.type === NOTIFICATION) {
    raw += [msg.event, msg.uri].joint(" ");
  }
  else {
    throw new Error("Unknown type of message");
  }
	raw += "\r\n";
	for (k in msg.headers) {
		raw += k + ": " + msg.headers[k] + "\r\n";
	}
  log("Msg Body type " + typeof(msg.body));
	if (typeof(msg.body) === 'object' && msg.body !== null) {
		raw += "\r\n";
		raw += JSON.stringify(msg.body);
	}
  else if (typeof(msg.body) !== 'undefined') {
    raw += "\r\n";
    raw += msg.body;
  }
	return raw;
};

var log = function(text) {
  console.log("fosp: " + text);
}

module.exports = {
	//REQUESTS: REQUESTS,
  //RESPONSES: RESPONSES,
	//EVENTS: EVENTS,
  REQUEST: REQUEST,
  RESPONSE: RESPONSE,
  NOTIFICATION: NOTIFICATION,
  URI: URI,
	parseMessage: parseMessage,
	serializeMessage: serializeMessage,
};
