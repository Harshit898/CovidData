const express = require('express');
const app = express();
const PORT = 5000;
const axios = require('axios');
const cheerio = require('cheerio');
app.use(express.static(__dirname + '/public'));
const xlsxFile = require('read-excel-file/node');
const bodyParser = require("body-parser");
var urlencodedParser = bodyParser.urlencoded({ extended: true });
app.set('view engine', 'ejs');
var fs = require("fs");
const multer = require('multer')
const upload = multer({ dest: 'uploads/' })
var cookieParser = require('cookie-parser');
var session = require('express-session');
app.use(cookieParser());
app.use('/public', express.static(__dirname + '/public'));
app.use(session({ resave: true, saveUninitialized: true, secret: 'keyboard cat', cookie:{maxAge: 600000}}));

var admin = require("firebase-admin");

var serviceAccount = require("./serviceAccountKey.json");
const { request } = require('http');

admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
	databaseURL: "https://coviddata-e2437.firebaseio.com"
});
let db = admin.firestore();
let plasma_donar = db.collection('plasma_donar');
let plasma_needer = db.collection('plasma_needer');
let hospital_data = db.collection("hosp_data").doc("states");
let labs_data = db.collection("lab_data").doc("states");
let corona_data = db.collection('corona-data');

//distance calculator
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
	var R = 6371; // Radius of the earth in km
	var dLat = deg2rad(lat2 - lat1);  // deg2rad below
	var dLon = deg2rad(lon2 - lon1);
	var a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
		Math.sin(dLon / 2) * Math.sin(dLon / 2)
		;
	var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	var d = R * c; // Distance in km
	return d;
}

function deg2rad(deg) {
	return deg * (Math.PI / 180)
}


//Web scraping
let coronaUpdate = setInterval(() => {
	//console.log("upadting our data");
	const url = "https://www.worldometers.info/coronavirus/";
	axios.get(url).then(resp=>{
		var data = [];
		const $ = cheerio.load(resp.data);
		$('.maincounter-number').each((i, elem)=>{
			var text = $(elem).text();
			text = text.replace('\n', '');
			text = text.replace('\n', '');
			data.push(text);
		});

		const url2 = "https://www.worldometers.info/coronavirus/country/india/";
		axios.get(url2).then(resps=>{
			var data1 = [];
			const $ = cheerio.load(resps.data);
			$('.maincounter-number').each((i, elem)=>{
				var text = $(elem).text();
				text = text.replace('\n', '');
				text = text.replace('\n', '');
				data1.push(text);
			});
			//console.log(data);

			corona_data.doc('world').set({
				total: data[0],
				deaths: data[1],
				recovered: data[2]
			}).then(function() {
				//console.log("Document successfully written!");
			})
			.catch(function(error) {
				console.error("Error writing document: ", error);
			});

			corona_data.doc('india').set({
				total: data1[0],
				deaths: data1[1],
				recovered: data1[2]
			}).then(function() {
				//console.log("Document successfully written!");
			})
			.catch(function(error) {
				console.error("Error writing document: ", error);
			});
			
		})
		.catch(err=>{
			console.log(err);
		})
	})
	.catch(err=>{
		console.log(err);
	})
}, 60000);



var hosp_data_update = setInterval(()=>{ 
	console.log("imin")
	const url = "https://coronaharyana.in/";
	axios.get(url).then(resp=>{
		data = [];
		var hosp_data = {};
		var lab_data = {};
		const $ = cheerio.load(resp.data);
		
		$('#tab0 > .community-posts-wrapper > .psahuDiv').each((i, elem)=>{
			var hosp_name;
			var boardline_no = "9878685848";
			var raw_text = $(elem).text();
			var ind = raw_text.indexOf("BoardLine Number:");

			if(ind != -1){
				ind = ind + 17;
				var num = "";
				while(raw_text[ind] >= '0' && raw_text[ind] <= '9' && ind < raw_text.length){
					num += raw_text[ind];
					ind++;
				}
				if(num != ""){
					boardline_no = num;
				}
			}

			$(elem).find('.tooltips_one').each(function (index, element) {
				var raw_text = $(element).text();
				raw_text = raw_text.split(":")[1];
				hosp_name = raw_text.trim();
				hosp_data[hosp_name] = [];
				hosp_data[hosp_name].push(hosp_name);
				hosp_data[hosp_name].push(boardline_no);
			  });
			$(elem).find('p').each((i, elm)=>{
				if(i == 0){
					var raw_data = $(elm).text();
					raw_data = raw_data.split(",");	
					for(var i = 0; i < raw_data.length; i++){
						var curr_data = raw_data[i].split("-")[1].replace( /[\r\n]+/gm, ""); 
						hosp_data[hosp_name].push(curr_data);
					}
					var k = raw_data.length;
					while(k < 4){
						hosp_data[hosp_name].push('0');
						k++;
					}
				}
			});

			$(elem).find('li > a').each((i, elm)=>{
				if(i == 0){
					var raw_data = $(elm).attr("onclick");
					    var coord_data = raw_data.split(";")[1].split("(")[1].split(",")[0].replace( /'/g, "")
                         + "," + raw_data.split(";")[1].split("(")[1].split(",")[1].replace( /'/g, "")
 				    hosp_data[hosp_name].push(coord_data);
					}
						
				});
		});


		//lab data updation
		$('#tab3 > .community-posts-wrapper > .psahuDiv').each((i, elem)=>{
			var lab_name;

			$(elem).find('.tooltips_one').each(function (index, element) {
				var raw_text = $(element).text();
				raw_text = raw_text.split(":")[1];
				lab_name = raw_text.trim();
				lab_data[lab_name] = [];
				lab_data[lab_name].push(lab_name);
			  });
			  

			$(elem).find('li > a').each((i, elm)=>{
				if(i == 0){
					var raw_data = $(elm).attr("onclick");
					    var coord_data = raw_data.split(";")[1].split("(")[1].split(",")[0].replace( /'/g, "")
                         + "," + raw_data.split(";")[1].split("(")[1].split(",")[1].replace( /'/g, "")
 				   lab_data[lab_name].push(coord_data);
					}
						
				});
		});
		
		
		//pushing udated data to database
		for (const p in hosp_data) {
			var new_data = {
				hosp_name: hosp_data[p][0],
				boardline_no: hosp_data[p][1],
				bed_availability: hosp_data[p][2],
				icu_beds: hosp_data[p][3],
				ventilators: hosp_data[p][4],
				isolation_beds: hosp_data[p][5],
				hosp_coords: hosp_data[p][6]
			}
			hospital_data.collection('haryana').doc(hosp_data[p][0]).set(new_data).then(()=>{
			 
			}).catch((err)=>{
				console.log("failed to set document");
			})
		}

		for (const p in lab_data) {
			var new_data = {
				lab_name: lab_data[p][0],
				lab_coords: lab_data[p][1]
			}
			labs_data.collection('haryana').doc(lab_data[p][0]).set(new_data).then(()=>{
			 
			}).catch((err)=>{
				console.log(err);
			})
		}
		})
		.catch(err=>{
			console.log(err);
		})
	
}, 5000);


//home route
app.get("/", function (req, res) {
	corona_data.get().then((cor) => {
		var data = [];
		var data1 = [];
		cor.forEach((doc) => {
			if(doc.id == 'world'){
				data.push(doc.data()['total']);
				data.push(doc.data()['deaths']);
				data.push(doc.data()['recovered']);
			}
			else if(doc.id == 'india'){
				data1.push(doc.data()['total']);
				data1.push(doc.data()['deaths']);
				data1.push(doc.data()['recovered']);
			}
		});
		res.render("home", {wd: data, id: data1});
	});
});


app.get("/admin", function (req, res) {
	res.render("admin");
});

app.post("/admin", urlencodedParser, (req, res) => {

	var username = req.body.username;
	var password = req.body.password;

	username = username.toLowerCase();
	password = password.toLowerCase();

	if (username !== 'admin') {
		res.redirect('/admin');
	} else {
		console.log("usernae vhafha");
		if (password !== 'mohit') {
			res.redirect('/admin');
		}

		else {
			req.session.isadmin = true;
			res.redirect("/needer_data");
		}
	}
});

app.get("/needer_data", urlencodedParser,function (req, res) {
	if (req.session.isadmin) {
		var data = [];
		var id = [];
		plasma_needer.get().then((needer) => {
			var pending_req = 0;
			var done_req = 0;
			needer.forEach((doc) => {
				data.push(doc.data());
				data[data.length- 1]['id'] = doc.id;
				id.push(doc.id);
				if(doc.data()['isChecked']) done_req++;
				else pending_req++;
			});
			data.sort(function(a, b) {
				return b.serial - a.serial;
			});
			res.render("needer_data", { data: data , id: id, pending: pending_req, done: done_req });
		});
	}
	else res.render("admin");
});


app.get("/donor_data", urlencodedParser,function (req, res) {
	if (req.session.isadmin) {
		var data = [];
		var id = [];
		plasma_donar.get().then((donor) => {
			var pending_req = 0;
			var done_req = 0;
			donor.forEach((doc) => {
				data.push(doc.data());
				data[data.length- 1]['id'] = doc.id;
				id.push(doc.id);
				if(doc.data()['isChecked']) done_req++;
				else pending_req++;
			});
			data.sort(function(a, b) {
				return b.serial - a.serial;
			});
			res.render("donor_data", { data: data , id: id, pending: pending_req, done: done_req  });
		});
	}
	else res.render("admin");
});

app.get("/view_image", function (req, res) {
	if (req.session.isadmin) {
		var id = req.query.id;
		plasma_needer.get().then((needer) => {
			needer.forEach((doc) => {
				if(doc.id == id){
					
					res.render("view_image", { data: doc.data().proof });
				}
			});
			
		});
	}
	else res.render("admin");
});

app.get('/changeStatus', (req, res)=>{
	var id = req.query.id;
	if (req.session.isadmin) {
		plasma_needer.get().then((needer) => {
			needer.forEach((doc) => {
				if(doc.id == id){
					var val = doc.data().isChecked;
					val = !val;
					plasma_needer.doc(id).update("isChecked", val);  
					res.redirect('/needer_data');
				}
			});
			
		});
	}
	else res.render("admin");
});

app.get('/changeStatuss', (req, res)=>{
	var id = req.query.id;
	//console.log(id);
	if (req.session.isadmin) {
		plasma_donar.get().then((donor) => {
			donor.forEach((doc) => {
				if(doc.id == id){
					var val = doc.data().isChecked;
					val = !val;
					plasma_donar.doc(id).update("isChecked", val);  
					res.redirect('/donor_data');
				}
			});
			
		});
	}
	else res.render("admin");
});

app.get("/hospital", (req, res) => {
	if(req.session.user_lat && req.session.user_long){
		var qr = req.query.SORTED_BY;
		hospital_data.collection('haryana').get().then((document) => {
			var rows = [];
			document.forEach((doci)=>{
				rows.push([]);
				rows[rows.length - 1].push(doci.data()['hosp_name']);
				rows[rows.length - 1].push(doci.data()['boardline_no']);
				rows[rows.length - 1].push(doci.data()['bed_availability']);
				rows[rows.length - 1].push(doci.data()['icu_beds']);
				rows[rows.length - 1].push(doci.data()['ventilators']);
				rows[rows.length - 1].push(doci.data()['isolation_beds']);
				var dst = getDistanceFromLatLonInKm(parseFloat(req.session.user_lat), parseFloat(req.session.user_long), parseFloat(doci.data()['hosp_coords'].split(",")[0]), parseFloat(doci.data()['hosp_coords'].split(",")[1]));
				dst = Number((dst).toFixed(2));
				rows[rows.length - 1].push(dst);
				rows[rows.length - 1].push(doci.data()['hosp_coords']);
			});
			switch (qr) {
				case "ds":
					rows.sort(function (a, b) { return a[6] - b[6] });
					res.render("hospital", { data: rows, qr: qr });
					break;
				case "bd":
					rows.sort(function (a, b) { return b[2] - a[2] });
					res.render("hospital", { data: rows, qr: qr });
					break;
				case "vt":
					rows.sort(function (a, b) { return b[4] - a[4] });
					res.render("hospital", { data: rows, qr: qr });
					break;
			}

		})
			
		}
		else res.render("getloc");
});

app.get("/user_location", (req, res) => {
	req.session.user_lat = req.query.lat;
	req.session.user_long = req.query.long;
	res.redirect("/hospital?SORTED_BY=ds");
});

app.get("/lab", function (req, res) {
	if(req.session.user_lat && req.session.user_long){
		labs_data.collection('haryana').get().then((doci)=>{
			var rows = [];
			doci.forEach((doc)=>{
				rows.push([]);
				rows[rows.length - 1].push(doc.data()['lab_name']);
				var dst = getDistanceFromLatLonInKm(parseFloat(req.session.user_lat), parseFloat(req.session.user_long), parseFloat(doc.data()['lab_coords'].split(",")[0]), parseFloat(doc.data()['lab_coords'].split(",")[1]));
				dst = Number((dst).toFixed(2));
				rows[rows.length - 1].push(dst);
				rows[rows.length - 1].push(doc.data()['lab_coords']);
			})

			rows.sort(function (a, b) { return a[1] - b[1] });
			res.render("lab", { data: rows });
		})	
	}
	else res.render("getloc");
});


app.get("/needer_register", function (req, res) {
	res.render("plasma_needer", { errors: [] });
});

app.post("/needer_register", upload.single('proofFile'), (req, res) => {
	var name = req.body.name;
	var contact = req.body.contact;
	var blood_grp = req.body.blood_grp;
	var city = req.body.city;
	var pincode = req.body.pincode;
	var state = req.body.state;
	var today = new Date();
	var time = new Date();
	var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
	var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();

	var dateTime = time + ' ' + date;

	var errors = [];


	//validation of inputs
	if (name.length < 2 || name.length > 30) errors.push(["Name can be max 30 chars and min 2 chars long "]);
	if (contact.length != 10 || contact.match("/^[0-9]+$/")) errors.push(["contact detail is incorrect"]);
	if (blood_grp.length == 0) errors.push(["Enter the valid blood_grp"]);
	if (city.length == 0) errors.push(["City can't be empty"]);
	if (pincode.length == 0 || pincode.match("/^[0-9]+$/")) errors.push(["Enter the valid pincode"]);

	//if there are errors return back
	// console.log(errors);
	console.log(req.file);
	var fileInfo = [];

	fileInfo.push({
		"originalName": req.file.originalName,
		"size": req.file.size,
		"b64": new Buffer(fs.readFileSync(req.file.path)).toString("base64")
	});


	//console.log(fileInfo);
	//if there are no errors save the details to database
	
	var count = 0;
	plasma_needer.get().then(function (snap) {
		count = snap.size;
		// console.log("size is ", count);
		var data = {
			name: name,
			contact: contact,
			blood: blood_grp,
			city: city,
			pincode: pincode,
			state: state,
			proof: fileInfo[0].b64,
			date: dateTime,
			serial: count,
			isChecked: false
		};
		plasma_needer.doc('plasma_needer_' + count).set(data);
		res.render("home");
	}).catch(function (error) {
		console.log("Error getting document:", error);
	});

});




app.get("/donor_register", function (req, res) {
	res.render("plasma_donar", { errors: [] });
});

app.post("/donor_register", urlencodedParser, (req, res) => {
	var name = req.body.name;
	var contact = req.body.contact;
	var blood_grp = req.body.blood_grp;
	var city = req.body.city;
	var pincode = req.body.pincode;
	var state = req.body.state;
	var today = new Date();
	var time = new Date();
	var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
	var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();

	var dateTime = time + ' ' + date;
//	console.log(dateTime);
//	console.log(contact);
	var errors = [];
	//validation of inputs
	if (name.length < 2 || name.length > 30) errors.push(["Name can be max 30 chars and min 2 chars long "]);
	if (contact.length != 10 || contact.match("/^[0-9]+$/")) errors.push(["contact detail is incorrect"]);
	if (blood_grp.length == 0) errors.push(["Enter the valid blood_grp"]);
	if (city.length == 0) errors.push(["City can't be empty"]);
	if (pincode.length == 0 || pincode.match("/^[0-9]+$/")) errors.push(["Enter the valid pincode"]);

	//if there are errors return back
	console.log(errors);
	if (errors.length > 0) res.render("plasma_donar", { errors: errors });

	//if there are no errors save the details to database
	
	var count = 0;
	plasma_donar.get().then(function (snap) {
		count = snap.size;
		console.log("size is ", count);
		var data = {
			name: name,
			contact: contact,
			blood: blood_grp,
			city: city,
			pincode: pincode,
			state: state,
			date: dateTime,
			serial:count,
			isChecked: false
		};
		plasma_donar.doc('plasma_donar_' + count).set(data);
		res.render("home");
	}).catch(function (error) {
		console.log("Error getting document:", error);
	});

});





app.listen(PORT, function (err) {
	if (err) console.log("Error in server setup");
	console.log("Server listening on Port", PORT);
});

