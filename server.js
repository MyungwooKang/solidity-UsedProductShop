var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var hbs = require('express-handlebars');
var app = express();
var fs = require("fs");


app.engine('html', hbs({extname: ".html"}));
app.use(express.static('src/public'));
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());
app.use(session({
 secret: '@#@$MYSIGN#@$#$',
 resave: false,
 saveUninitialized: true
}));

app.set('view engine','html');
app.set('views', __dirname + '/src/views');


var server = app.listen(3000, function(){
  console.log("Express server has started on port 3000");
});

var router = require('./route/main.js')(app, fs);
