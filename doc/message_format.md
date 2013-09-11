# FOSP
### Federated object storage protocol

#### Introduction

The federated object storage protocol tries to solve three problems:
1. How to store data in a network and support standart operations on it.
2. How to enforce access control on the data, for useres from different hosts, without central authentication.
3. How to notify users when data is added, removed or has changed.
Additionally we want to keep certain constraints:
1. The protocol needs tp be data agnostic and should support structured, unstructured and metadata.
2. The protocol must be as simple as possible, it must be easy to implement and programms that use it should be easy to deploy.

#### Network topology
The network of the agents that use the protocol is, like the smtp network, federated.

##### Participants
There are two kind of agents in the network, clients and servers.
##### Message flow

#### Messages

##### Format

**WARNING: To simplify the definition for the moment, only ASCII characters are allow. This WILL change as the protocol itself mandates the use of Unicode and the UTF-8 encoding and international user and resource names MUST be supported**

Also the header definition will be subject to change after determining acceptable characters.
For the resource identifier, we will probably refer to the IRI definition in the future.

    message         = request / response / notification

    request         = request-type SP ( resource-id / "*" ) SP sequence-number CRLF headers [ CRLF body ]
    request-type    = "CONNECT" / "AUTHENTICATE" / "REGISTER" / "CREATE" / "SELECT" / "UPDATE" / "DELETE" / "READ" / "WRITE"

    response        = response-type SP response-status SP sequence-number CRLF headers [ CRLF body ]
    response-type   = "SUCCEDED" / "FAILED"

    notification    = event-type SP resource-id CRLF headers [ CRLF body ]
    event-type      = "CREATED" / "UPDATED" / "DELETED"

    headers         = *( header CRLF )
    header          = header-key ":" SP header-value
    header-key      = ALPHA *( ALPHANUM / "-" ) ( ALPHANUM )
    header-value    = 1*( ALPHANUM / "/" / "-" / "<" / ">" / "=" / "+" / "_" / ";" / "!" / "~" / "*" / "." )

    resource-id     = user-name "@" domain [ path ]
    user-name       = ALPHA *( ALPHANUM / "_" / "-" / "+" / "." ) ( ALPHANUM )
    domain          = domain-part *( "." domain-part ) [ "." ]
    domain-part     = ALPHANUM / ( ALPHANUM *( ALPHANUM / "-" / "_" ) ALPHANUM )

    path            = "/" / 1*( "/" path-part )
    path-part       = 1*( ALPHANUM / "\" / "." / "+" / "*" / "-" / "_" / ";" / ":" / "!" / "~" / "=" / "<" / ">" )

    ALPHANUM        = ALPHA / DIGIT

##### Serialization

#### Objects
##### Format
##### Serialization
##### Hierarchy
##### Fields and their meaning
##### Standart objects

#### Server policies





