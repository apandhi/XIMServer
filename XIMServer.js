var xim_version = "0.73";
var WebSocketServer = require('websocket').server;
var http = require('http');
var minimum_build = 300;
var connections = new Array();
var connections_url = new Array();
var connections_id = new Array();
var debugging_mode = true;
var fs = require('fs');
var os = require('os');
var prompt = require('prompt');
var prompt2 = require('prompt');
var md5 = require('MD5');
var crypto = require('crypto');
var ban_list = new Array();
var pins = new Array();
var pins_url = new Array();
var should_save_pins = false;
var should_save_cached = false;
var accept_connections = true;
// var cached_messages_count = 0;
// var cached_messages = new Array();
var cached_messages_to = new Array();
var cached_messages_messages = new Array();
var cached_messages_count = 0;
var server = http.createServer(function(request, response) {
  	response.writeHead(200, {'Content-Type': 'text/plain'});
  	response.end('Looks like you can reach XIM servers.\nCongrats!');
    response.end();
});

console.log('[ SYS ] XIM Server ' + xim_version);

read_settings();
server.listen(8081, function() {
    console.log('[ SYS ] Server listening to connections now.');
    prompt_start();
});

wsServer = new WebSocketServer({
    httpServer: server,
    disableNagleAlgorithm: true,
    autoAcceptConnections: true,
    maxReceivedMessageSize: "4MiB"
});

// Save pins and cached every 5 mins
setInterval(function() {
	if (should_save_pins === true) {
		save_pins();
		should_save_pins = false;
	}
	if (should_save_cached === true) {
		save_cached();
		should_save_cached = false;
	}
}, 10 * 60 * 1000);

// Check CPU usage every minute.
setInterval(function() {

	var loads = os.loadavg();
	//console.log("[ DBG ] CPU Load: " + loads[0]);
	if (loads[0] >= 90) {
		// Too much CPU usage!
		console.log("[ WRN ] Too much CPU usage! Blocking new connections");
		accept_connections = false;
	} else {
		aceept_connections = true;
	}

}, 5 * 60 * 1000);

/// Set up CUI
  
function prompt_start() {

	prompt.start();
	prompt.colors = false;
	prompt.message = "";
	prompt.delimiter = "";
	
	prompt2.start();
	prompt2.colors = false;
	prompt2.message = "";
	prompt2.delimiter = "";
	prompt_get();

}

function read_settings() {

	read_bans();
	read_pins();
	read_cached();

}

function write_settings() {

	save_bans();
	save_pins();
	save_cached();

}

function read_bans() {

	if (fs.existsSync("bans.txt") === false) {
		console.log("[ SYS ] Created bans.txt");
		var tmp_file = fs.openSync("bans.txt", 'w');
		fs.closeSync(tmp_file);
	}
	
	var m_contents = fs.readFileSync("bans.txt");
	try { 
		ban_list = JSON.parse(m_contents);
		console.log("[ SYS ] Loaded " + ban_list.length + " banned users.");
	} catch(e) {
		ban_list = new Array();
		console.log("[ ERR ] Can not load bans.txt, corrupt/blank file [" + e.message + "]");
		save_bans();
	}

}

function save_bans() {

	fs.writeFileSync("bans.txt", JSON.stringify(ban_list)); 
	console.log("[ SYS ] Saved ban_list contents to bans.txt");
	
}

function ban_user(username) {

	if (ban_list.indexOf(username) !== -1) {
		console.log("ban: Can't ban " + username + ", already banned.");
	} else {
		ban_list.push(username);
		save_bans();
		console.log("ban:" + username + " banned.");
	}

}

function unban_user(username) {

	if (ban_list.indexOf(username) === -1) {
		console.log("unban: Can't unban " + username + ", not banned.");
	} else {
		ban_list.splice(ban_list.indexOf(username),1);
		save_bans();
		console.log("unban:" + username + " unbanned.");
	}

}

function list_bans() {

	console.log("---------- LISTING ARRAY -----------");
	for (var i=0;i<ban_list.length;i++) {
		console.log(i + ": " + ban_list[i]);
	}
	console.log("---------- LISTING ENDED -----------");

}

function get_pin(username) {

	if (pins_url.indexOf(username) === -1) {
		return m_md5("0000");
	} else {
		return pins[pins_url.indexOf(username)];
	}

}

function set_pin(username, pin) {

	if (pins_url.indexOf(username) === -1) {
		pins_url.push(username);
		pins.push(m_md5(pin));
	} else {
		pins[pins_url.indexOf(username)] = m_md5(pin);
	}
	
	should_save_pins = true;
	//save_pins();

}

function read_pins() {

	if (fs.existsSync("user_pins.txt") === false) {
		console.log("[ SYS ] Created user_pins.txt");
		var tmp_file = fs.openSync("user_pins.txt", 'w');
		fs.closeSync(tmp_file);
	}
	
	var m_contents = fs.readFileSync("user_pins.txt");
	try { 
		var tmp_obj = JSON.parse(m_contents);
		pins_url = new Array();
		pins = new Array();
		for(var pin in tmp_obj.pins) {
			var m_object = tmp_obj.pins[pin];
			if (m_object.url !== "" && m_object.pin !== "") {
				pins.push(m_object.pin);
				pins_url.push(m_object.url);
			}
		}
		console.log("[ SYS ] Loaded " + pins_url.length + " user pins.");
	} catch(e) {
		pins_url = new Array();
		pins = new Array();
		console.log("[ ERR ] Can not load user_pins.txt, corrupt/blank file [" + e.message + "]");
		save_pins();
	}

}

function save_pins() {

	var m_object = new Object();
	m_object.pins = new Array();
	
	for (var i=0;i<pins_url.length;i++) {
		var t_object = new Object();
		t_object.url = pins_url[i];
		t_object.pin = pins[i];
		m_object.pins.push(t_object);
	}
	
	fs.writeFileSync("user_pins.txt", JSON.stringify(m_object)); 

}

function save_cached() {

// 	var m_arr = new Array();
// 	for (var obj in cached_messages) {
// 		m_arr.push(cached_messages[obj]);
// 	}

	var m_array = new Array();
	for (var i=0;i<cached_messages_to.length;i++) {
		var m_object = new Object();
		m_object.username = cached_messages_to[i];
		m_object.messages = cached_messages_messages[i];
		m_array.push(m_object);
		//console.log(JSON.stringify(m_object));
	}
	
	fs.writeFileSync("cached.txt", JSON.stringify(m_array)); 
	
}

function read_cached() {

	if (fs.existsSync("cached.txt") === false) {
		console.log("[ SYS ] Created cached.txt");
		var tmp_file = fs.openSync("cached.txt", 'w');
		fs.closeSync(tmp_file);
	}
	
	var m_contents = fs.readFileSync("cached.txt");
	cached_messages_count = 0;
	cached_messages_to = new Array();
	cached_messages_messages = new Array();
	
	try {
	
		var m_array = JSON.parse(m_contents);
		for (var obj in m_array) {

			if(typeof m_array[obj].messages === "undefined") { continue; }
			
			cached_messages_to.push(m_array[obj].username);
			cached_messages_messages.push(m_array[obj].messages);
			
			cached_messages_count = cached_messages_count + m_array[obj].messages.length;

		}		
		console.log("[ SYS ] Loaded " + cached_messages_count + " messages from cached.txt");
	
	} catch(e) {
		console.log("[ ERR ] Can not load cached.txt, corrupt/blank file [" + e.message + "]");
		//cached_messages_count = 0;
		//cached_messages = new Array();
		//save_cached();
	}

}

function prompt_get() {

	prompt.get([{ name: 'command', message: '>' }], function (err, result) {
	
		result.command = result.command.toLowerCase();
	
		if (result.command === "help" || result.command === "?") {
			console.log("arr, props, carr, ver, ban, unban, lban, mem, warn, minb, rpin, save");
		}
		
		if (result.command === "rpin") {
			prompt2.get([{ name: 'command', message: 'reset pin of whom? ' }], function (err, result) {
				if (result.command !== "") {
					set_pin(result.command, "0000");
				}
				console.log("");
				prompt_get();
			});
			return;
		}
		
		if (result.command === "ban") {
			prompt2.get([{ name: 'command', message: 'ban who? ' }], function (err, result) {
				if (result.command !== "") {
					ban_user(result.command);
				}
				console.log("");
				prompt_get();
			});
			return;
		}
		
		if (result.command === "unban") {
			prompt2.get([{ name: 'command', message: 'unban who? ' }], function (err, result) {
				if (result.command !== "") {
					unban_user(result.command);
				}
				console.log("");
				prompt_get();
			});
			return;
		}
		
		if (result.command === "warn") {
			for (var i=0;i<connections.length;i++) {
				connections[i].sendUTF("XIM_SHUTDOWN_WARNING");
			}
		}
		
		if (result.command === "save") {
			console.log("Saving contents of memory.");
			write_settings();
		}
		
		if (result.command === "minb") {
			console.log(minimum_build);
		}
		
		if (result.command === "lban") {
			list_bans();
		}
		
		if (result.command === "cpu") {
			dbg_list_cpu();
		}
		
		if (result.command === "ver") {
			console.log("xim server " + xim_version);
		}
		
		if (result.command === "carr") {
			dbg_list_cached();
		}
		
		if (result.command === "arr") {
			dbg_list_array();
		}
		
		if (result.command === "props") {
			dbg_list_array(true);
		}
		
		if (result.command === "mem") {
			console.log((os.totalmem() / 1024) + " kb installed");
			console.log((os.freemem() / 1024) + " kb free");
		}
		
		console.log("");
		prompt_get();
	});

}

function originIsAllowed(origin) {
	// put logic here to detect whether the specified origin is allowed.
	// console.log("[ DBG ] User's origin is " + origin);
	return true;
}

wsServer.on('connect', function(connection) {

	// Check if we should accept users.
	if (accept_connections === false) {
		connection.write("XIM_TOO_MANY");
		connection.close();
		return;
	}

	var m_temp_id = makeid();
	if (connections_url.indexOf(m_temp_id) !== -1) {
		while(connections_url.indexOf(m_temp_id) !== -1) {
			m_temp_id = makeid();
		}
	}
	
	//console.log("[ DBG ] Generated m_temp_id " + m_temp_id);
	connection.socket_id = m_temp_id;
	var n_length = connections.push(connection);
	connections_url.push(m_temp_id);
	connections_id.push(m_temp_id);
	connection.array_index = n_length - 1;
	connection.photo_data = "";

    connection.on('message', function(message) {
    	if (message.type === "binary") {
    		// Something weird/fishy going on.
    		console.log("[ ERR ] Security error, got binary");
    		connection.close();
    		return;
    	}
    	process(connection, message.utf8Data);
    });
    
    connection.on('close', function(reasonCode, description) {
        // console.log("[ USR ] Peer " + connection.remoteAddress + " disconnected.");
        log_out(connection);
    });
    
});

function log_out(connection) {

	// console.log("[ USR ] Logging \"" + connection.xim_username + "\" logging out.");
	broadcast_to_buddies(connection, "XIM_STATUS " + connection.xim_username + "\n0");
	var m_index = connections_id.indexOf(connection.socket_id);
	if (m_index !== -1) {
		connections.splice(m_index, 1);
		connections_url.splice(m_index, 1);
		connections_id.splice(m_index, 1);
	} else {
		//console.log("[ DBG ] Index of \"" + connection.xim_username + "\" socket can't be found.");
	}
	//dbg_list_array();
	connection.close();

}


function dbg_list_cpu() {

	var m_arr = os.loadavg();
	console.log("---------- LISTING ARRAY -----------");
// 	for (var obj in cached_messages) {
// 		console.log(obj + ": " + cached_messages[obj].messages.length);
// 	}
	for (var i=0;i<m_arr.length;i++) {
		console.log(i + ":" + m_arr[i]);
	}
	console.log("---------- LISTING ENDED -----------");

}

function dbg_list_cached(end_after_props) {

	console.log("---------- LISTING PROPS -----------");
	console.log("   cached messages count: " + cached_messages_count);
	console.log("---------- LISTING ENDED -----------");
	
	if (end_after_props === true) { return; }

	console.log("---------- LISTING ARRAY -----------");
// 	for (var obj in cached_messages) {
// 		console.log(obj + ": " + cached_messages[obj].messages.length);
// 	}
	for (var i=1;i<cached_messages_to.length;i++) {
		console.log(cached_messages_to[i] + ":");
		console.log(cached_messages_messages[i]);
	}
	console.log("---------- LISTING ENDED -----------");

}

function dbg_list_array(end_after_props) {

	console.log("---------- LISTING PROPS -----------");
	console.log("      connections length: " + connections.length);
	console.log("  connections_url length: " + connections_url.length);
	console.log("   connections_id length: " + connections_id.length);
	console.log("   cached messages count: " + cached_messages_count);
	console.log("---------- LISTING ENDED -----------");
	
	if (end_after_props === true) { return; }

	console.log("---------- LISTING ARRAY -----------");
	for (var i=0;i<connections_url.length;i++) {
		console.log(i + ": " + connections_url[i]);
	}
	console.log("---------- LISTING ENDED -----------");

}

function process(connection, data) {

	if (data === "XIM_CLOSE") {
		log_out(connection);
		return;
	}
	
	if (data.substring(0,9) === "XIM_OPEN ") {
	
		// Check build.
		build_id = data.substring(9);
		if (parseInt(build_id) < minimum_build) {
			//console.log("[ USR ] Wrong version, got " + build_id);
			connection.sendUTF("XIM_SERVICE_MSG You need to update XIM to connect.<br/>Please update XIM by going to <b>XKit Control Panel > XIM > Update</b>");
			connection.close();
			return;
		}
	
		// Generate and submit nonce.
		connection.nonce = makeid();
		connection.sendUTF("XIM_AUTH " + connection.nonce);
		return;
	
	}
	
	if (data.substring(0,9) === "XIM_SETP ") {
	
		var m_array = data.substring(9).split(";");
		
		if (m_array.length !== 2 || m_array[0] === "" || m_array[1] === "") {
			// Fishy things going on.
			console.log("[ DBG ] PE: Incorrect XIM_SETP array size");
			give_protocol_error(connection);
			return;
		}
		
		// Retrieve what we received.
		var m_url = m_array[0];
		var m_pin = m_array[1];
		
		if (get_pin(m_url) !== m_md5("0000")) {
			connection.sendUTF("XIM_PIN_ALREADY_SET");
			connection.close();
			return;
		}
		
		set_pin(m_url, m_pin);
		connection.sendUTF("XIM_PIN_SET_OK");
		return;
		
	
	}

	if (data.substring(0,9) === "XIM_AUTH ") {
	
		// Check hash. It is:
		// m_md5(nonce + url + pin + "xenixlet");
		var m_array = data.substring(9).split(";");
		
		if (m_array.length !== 2 || m_array[0] === "" || m_array[1] === "") {
			// Fishy things going on.
			console.log("[ DBG ] PE: Incorrect XIM_AUTH array size");
			give_protocol_error(connection);
			return;
		}
		
		// Retrieve what we received.
		var m_url = m_array[0];
		var m_hash = m_array[1];
		
		if (is_online(m_url) === true) {
			// User already online!
			//console.log("[ USR ] User already online, disconnecting.");
			connection.sendUTF("XIM_ONE_TAB_PLEASE");
			connection.close();
			return;
		}
		
		if (get_pin(m_url) === m_md5("0000")) {
			connection.sendUTF("XIM_SET_PIN");
			connection.close();
			return;
		}
		
		// Computate hash.
		var m_generated = m_md5(connection.nonce + m_url + get_pin(m_url) + "xenixlet");
		
		if (m_hash === m_generated) {
			// Hooray! Hash passed!
			connection.hash_passed = true;
			connection.xim_username = m_url;
			connection.sendUTF("XIM_AUTH_STATUS 1");
		} else {
			// Hash failed, kick the bitch out.
			connection.sendUTF("XIM_AUTH_STATUS 0");
			log_out(connection);
		}

		return;
	
	}


	/*
		Function XIM_RESET
		Usage: XIM_RESET Username
		Return: XIM_RESET Hash
	*/
	
	if (data.substring(0, 10) === "XIM_RESET ") {

	    var m_array = data.substring(10).split(";");

	    if (m_array.length !== 1 || m_array[0] === "") {
	        // Fishy things going on.
	        console.log("[ DBG ] PE: Incorrect XIM_RESP array size");
	        give_protocol_error(connection);
	        return;
	    }

	    // Retrieve what we received.
	    var m_url = m_array[0];

	    // Computate hash.
	    var m_generated = makeid();

	    // Hash failed, kick the bitch out.
	    connection.sendUTF("XIM_RESET " + m_generated);
	    connection.reset.key = m_generated;
	    connection.reset.url = m_url;
	    return;
	}

	/*
		Function XIM_RESET_CHECK
		Usage: XIM_RESET_CHECK Post_id
		Return: Success - XIM_RESET_RESPONSE 1
				Failure - XIM_RESET_RESPONSE 0
	*/

	if (data.substring(0, 16) === "XIM_RESET_CHECK ") {

	    var m_array = data.substring(16).split(";");

	    if (m_array.length !== 1 || m_array[0] === "") {
	        // Fishy things going on.
	        console.log("[ DBG ] PE: Incorrect XIM_RESET_CHECK array size");
	        give_protocol_error(connection);
	        return;
	    }

	    // Retrieve what we received.
	    var m_id = m_array[0];

	    var options = {
	        host: connection.reset.url + '.tumblr.com',
	        port: 80,
	        path: '/api/read/json?id=' + m_id,
	        method: 'GET'
	    };

	    var req = http.get(options, function (res) {
	        var pageData = "";
	        res.setEncoding('utf8');
	        res.on('data', function (chunk) {
	            pageData += chunk;
	        });

	        res.on('end', function () {
	            postData = JSON.parse(pageData.split(" = ")[1]);
	            if (postData.posts[0]["regular-body"] === connection.reset.key) {
	                set_pin(connection.reset.url, "0000");
	                connection.sendUTF("XIM_RESET_RESPONSE 1");
	            } else {
	                connection.sendUTF("XIM_RESET_RESPONSE 0");
	            }
	        });
	    });

	    return;
	}


	// From here, we need to check if the client passes hash check.
	// If they did not, we gotta kick them.
	if (connection.hash_passed === false) {
		console.log("[ ERR ] Security error, kicking out.");
		connection.sendUTF("XIM_PROTOCOL_ERROR_SECURITY");
		log_out(connection);
		return;
	}

	if (data.substring(0,12) === "XIM_BUDDIES ") {
	
		var contacts = data.substring(12);
		
		if (connection.xim_username === "") {
			console.log("[ DBG ] XIM_Buddies username blank");
			give_protocol_error(connection);
			return;
		}
		
		if (ban_list.indexOf(connection.xim_username) !== -1) {
			connection.sendUTF("XIM_BANNED");
			connection.close();
			return;
		}
		
		connections_url[connections_id.indexOf(connection.socket_id)] = connection.xim_username;
		connection.contacts = contacts.split(";");
		
		var to_send = "";
		var len = connection.contacts.length;
		for (var i=0;i<len;i++) {
			if (is_online(connection.contacts[i]) === true || connection.contacts[i] === connection.xim_username) {
				to_send = to_send + "\n" + connection.contacts[i]  + ";1";
				
			} else {
				to_send = to_send + "\n" + connection.contacts[i]  + ";0";
			}
		}
		
		//dbg_list_array();
		connection.sendUTF("XIM_BUDDY_LIST" + to_send);
		
		// Send cached messages, if there are any.
		send_cached(connection);
		
		// Broadcast status to people.
		broadcast_to_buddies(connection, "XIM_STATUS " + connection.xim_username + "\n1");
		return;

	}
	
	if (data.substring(0,10) === "XIM_CHECK ") {
	
		// Client checking online status of someone.
		
		if (is_online(data.substring(10)) === true) {
			connection.sendUTF("XIM_STATUS " + data.substring(10) + "\n1");
		} else {
			connection.sendUTF("XIM_STATUS " + data.substring(10) + "\n0");
		}
		
		return;
	
	}
	
	if (data.substring(0,23) === "XIM_PHOTO_REQUEST_REST ") {
	
		// The other side wants more.
		//console.log("user " + connection.xim_username + " wants more from " + data.substring(23));
		
		if (is_online(data.substring(23)) === false) {
			send_to_user(connection.xim_username, "XIM_PHOTO_INTERRUPTED " + data.substring(23));
			return;
		}
		
		send_to_user(data.substring(23), "XIM_PHOTO_NEXT");
		return;
	
	}
	
	if (data.substring(0,10) === "XIM_PHOTO ") {
	
		// Initiate photo transfer
	
		try {
		
			connection.photo_data = "";
			
			var m_data = data.substring(10).split("\n");
			var m_to = m_data[0];
			var m_picture = m_data[1];
		
			if (is_online(m_to) === false) {
				//console.log("OFFLINE.");
				connection.sendUTF("XIM_PHOTO_STATUS " + m_to + "\n0");
				return;
			}
			
			connection.photo_data_to = m_to;
			connection.photo_data_start = 0;
			
			//console.log("first pack size = " + m_picture.length);
			
			send_to_user(m_to, "XIM_PHOTO_FIRST " + connection.xim_username + "\n" + m_picture);
			//setTimeout(function() { connection.sendUTF("XIM_PHOTO_NEXT"); }, 500);
			//connection.sendUTF("XIM_PHOTO_STATUS " + m_to + "\n1");
			
		} catch(e) {
			
			console.log("[ ERR ] On XIM_PHOTO: " + e.message);
			give_protocol_error(connection);
		
		}
		
		return;
	
	}
	
	if (data.substring(0,12) === "XIM_PHOTO_C ") {
	
		// Get photo chunk
	
		try {

			var m_data = data.substring(12);
			//console.log("addt. pack size = " + m_data.length);
			//connection.photo_data = connection.photo_data + m_data;
			//connection.sendUTF("XIM_PHOTO_NEXT");
			
			/*if (is_online(connection.photo_data_to) === false) {
				send_to_user(connection.xim_username, "XIM_PHOTO_INTERRUPTED " + connection.photo_data_to);
				return;
			}*/
			
			send_to_user(connection.photo_data_to, "XIM_PHOTO " + connection.xim_username + "\n" + m_data);
			//connection.sendUTF("XIM_PHOTO_STATUS " + m_to + "\n1");
			
		} catch(e) {
			
			give_protocol_error(connection);
		
		}
		
		return;
	
	}
	
	if (data === "XIM_PHOTO_COMPLETE") {
	
		// Photo transfer complete!
		
		if (is_online(connection.photo_data_to) === false) {
			send_to_user(connection.xim_username, "XIM_PHOTO_INTERRUPTED " + connection.photo_data_to);
			return;
		}

		console.log("COMPLETE! Size = " + connection.photo_data.length);
		send_to_user(connection.photo_data_to, "XIM_PHOTO_LAST " + connection.xim_username + "\n" + connection.photo_data);
		//connection.sendUTF("XIM_PHOTO_STATUS " + m_to + "\n1");

		return;
	
	}
	
	if (data.substring(0,9) === "XIM_SEND ") {
	
		try {
	
			// Sending messages!
			var m_data = data.substring(9).split("\n");
			var m_to = m_data[0];
			var m_message = strip_html(m_data[1]);
		
			if (m_to === "" || m_message === "") {
				return;
			}
		
			if (m_message.toLowerCase() === "/system_info") {
				connection.sendUTF("XIM_MSG_STATUS " + m_to + "\n1\n" + "OSC:" + (connections.length) + "\nsystem");
				return;
			}

			if (is_online(m_to) === false) {
				// User is online. Cache the message.
				add_to_cache(m_to, m_message, connection.xim_username);
				connection.sendUTF("XIM_MSG_STATUS " + m_to + "\n2\n" + m_message + "\n" + connection.xim_username);
				return;
			}
		
			connection.sendUTF("XIM_MSG_STATUS " + m_to + "\n1\n" + m_message + "\n" + connection.xim_username);
			send_to_user(m_to, "XIM_MSG " + connection.xim_username + "\n" + m_message);
		
		} catch(e) {
		
			give_protocol_error(connection);
		
		}
		
		return;

	}
	
	// Unknown - corrupt package received.
	console.log("[ DBG ] Unknown package received");
	give_protocol_error(connection);

}

function send_cached(connection) {

	var my_username = connection.xim_username;
	var m_index = cached_messages_to.indexOf(my_username);
	if (m_index === -1) {
		// No cached messages for this user.
		return;
	}
	
	var m_messages = cached_messages_messages[m_index];

	while (m_messages.length > 0) {
		send_to_user(my_username, "XIM_MSG " + m_messages[0].sender + "\n" + m_messages[0].message);
		cached_messages_count = cached_messages_count - 1;
		m_messages.shift();
	}
	
	cached_messages_to.splice(m_index,1);
	cached_messages_messages.splice(m_index,1)
	
}

function add_to_cache(user, msg, from) {

	var m_index = cached_messages_to.indexOf(user);
	
	if (m_index === -1) {
		// User does not exist. Lets create it now.
		cached_messages_to.push(user);
		cached_messages_messages.push(new Array());
		m_index = cached_messages_to.indexOf(user);
	}
	
	var msg_object = new Object();
	msg_object.sender = from;
	msg_object.message = msg;

	cached_messages_messages[m_index].push(msg_object);
	should_save_cached = true;
	cached_messages_count++;
	
}

function broadcast_to_buddies(connection, msg) {

	if (typeof connection.contacts === "undefined") {
		//console.log("[ DBG ] User's contact list undefined, quitting.");
		return;
	}

	/*for(i=0;i<connection.contacts.length;i++) {
		if (typeof connection.contacts[i] === "undefined") { console.log("[ DBG ] broadcast: quit, no username"); continue; }
		send_to_user(connection.contacts[i], msg);
	}*/
	
	for (var i=0;i<connections.length;i++) {
		if (typeof connections[i].contacts === "undefined") { continue; }
		if (connections[i].contacts.indexOf(connection.xim_username) !== -1) {
			connections[i].sendUTF(msg);
		}
	}

}

function send_to_user(m_to, m_message) {

	if (m_to === "") { console.log("[ DBG ] send_to_user: quit, no m_to"); return; }
	var m_index = connections_url.indexOf(m_to);
	if (m_index === -1) { console.log("[ DBG ] send_to_user: quit, index -1"); return; }
	
	var m_socket = connections[m_index];
	//console.log("[ DBG ] send_to_user: sending to " + m_index);
	m_socket.sendUTF(m_message);

}

function is_online(username) {

	if (connections_url.indexOf(username) !== -1) {
		return true;
	} else {
		return false;
	}

}

function strip_html(txt) {

	//var regex = /(<([^>]+)>)/ig;
	//txt = txt.replace(regex, "");
	
	txt = replaceAll(txt, "<","&lt;");
	txt = replaceAll(txt, ">","&gt;");
	return txt;

}

function replaceAll(txt, replace, with_this) {
  return txt.replace(new RegExp(replace, 'g'),with_this);
}

function give_protocol_error(connection) {

	console.log("[ ERR ] Protocol error, disconnecting");
	connection.sendUTF("XIM_PROTOCOL_ERROR");
	log_out(connection);
	connection.close();

}


function makeid()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 63; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function m_md5(m_str) {

	return crypto.createHash('md5').update(m_str).digest("hex");

}
