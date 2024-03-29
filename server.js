// start app with 'node server.js' or 'npm run dev' in a terminal window
// go to http://localhost:port/ to view your deployment!
// every time you change something in server.js and save, your deployment will automatically reload

// to exit, type 'ctrl + c', then press the enter key in a terminal window
// if you're prompted with 'terminate batch job (y/n)?', type 'y', then press the enter key in the same terminal

// standard modules, loaded from node_modules
const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const express = require('express');
const morgan = require('morgan');
const serveStatic = require('serve-static');
const bodyParser = require('body-parser');
const cookieSession = require('cookie-session');

// our modules loaded from cwd

const { Connection } = require('./connection');
const cs304 = require('./cs304');
const e = require('connect-flash');

// Create and configure the app

const app = express();

// Morgan reports the final status code of a request's response
app.use(morgan('tiny'));

app.use(cs304.logStartRequest);

// This handles POST data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cs304.logRequestData);  // tell the user about any request data

app.use(serveStatic('public'));
app.set('view engine', 'ejs');

const mongoUri = cs304.getMongoUri();

// ================================================================
// custom routes here

// Use these constants and mispellings become errors
const WMDB = "wmdb";
const PEOPLE = "people";
const MOVIE = "movies";
const STAFF = "staff";

// this list is also used to generate the menu, so element 0 is the default value

const monthNames = ['select month', 'January', 'February', 'March',
                    'April', 'May', 'June',
                    'July', 'August', 'September',
                    'October', 'November', 'December' ];


// main page. just has links to two other pages
app.get('/', (req, res) => {
    return res.render('index.ejs', {monthNames} );
});

function personDescription(person) {
    let p = person;
    let bday = (new Date(p.birthdate)).toLocaleDateString();
    return `${p.name} (${p.nm}) born on ${bday}`;
}

app.get('/nm/:nm', async (req, res) => {
    const personID = req.params.nm;

    const db = await Connection.open(mongoUri, WMDB);

    //find person
    const people = db.collection(PEOPLE);
    const person = await people.find({nm: parseInt(personID)}).toArray();

    // create description of person
    let name = person[0].name;
    let addedBy = person[0].addedby.name;
    let birthdate = person[0].birthdate;
    let movieList = person[0].movies;

    return res.render('person.ejs',
                      {description: `${name}, added by ${addedBy}, was born on ${birthdate}`,
                       personName: name,
                       movieList: movieList
                    });
});

app.get('/tt/:tt', async (req, res) => {
    const movieID = req.params.tt;

    const db = await Connection.open(mongoUri, WMDB);

    //find person
    const movies = db.collection(MOVIE);
    const movie = await movies.find({tt: parseInt(movieID)}).toArray();

    // create description of person
    let title = movie[0].title;
    let release = movie[0].release;
    let cast = movie[0].cast;

    return res.render('movie.ejs',
                      {description: `${title}, released on ${release}`,
                       titleName: title,
                       cast: cast
                        });
});

// get info from form 
app.get('/search/', async (req, res) => {
    const term = req.query.term;
    const kind = req.query.kind;
    console.log(`You submitted ${term} and ${kind}`);
    const db = await Connection.open(mongoUri, WMDB);
    const people = db.collection(PEOPLE);
    const movie = db.collection(MOVIE);
    let result = []
    if (kind=="person"){
        result = await people.find({name: new RegExp([term].join(""), "i")}).toArray();
        console.log(result.length);
        if (result.length == 0){
            // how to make it just append to top of page
            return res.send(`<em>error</em> person is not valid`);
        }
        if (result.length == 1){
            const personId = parseInt(result[0].nm);
            res.redirect(`/nm/`+personId);
        } 
        if (result.length > 1) {
            // create list of links
            return res.send(`Mulitple people!`);
        }
    } else {
        result = await movie.find({title: new RegExp([term].join(""), "i")}).toArray();
        if (result.length == 0){
            return res.send(`Sorry, movie not found`);
        }
        if (result.length == 1){
            const movieID = parseInt(result[0].tt);
            res.redirect(`/tt/`+movieID);
        } 
        if (result.length > 1) {
            //create list of links
            return res.send(`Mulitple movies!`);
        }
    }
    
});

// list all people in the wmdb.people table

app.get('/people/', async (req, res) => {
    const db = await Connection.open(mongoUri, WMDB);
    const people = db.collection(PEOPLE);
    let all = await people.find({}).toArray();
    let descs = all.map(personDescription);
    let now = new Date();
    let nowStr = now.toLocaleString();
    return res.render('list.ejs',
                      {listDescription: `all people as of ${nowStr}`,
                       list: descs});
});
    
app.get('/people2/', async (req, res) => {
    const db = await Connection.open(mongoUri, WMDB);
    const people = db.collection(PEOPLE);
    let all = await people.find({}).toArray();
    let now = new Date();
    let nowStr = now.toLocaleString();
    return res.render('listPeople.ejs',
                      {listDescription: `all people (v2) as of ${nowStr}`,
                       list: all});
});

// This function filters a list of dictionaries for those with the correct targetMonth.
// The target month is 1-based, so January = 1, etc. 

function peopleBornInMonth(dictionaryList, targetMonth) {
    function isRightMonth(p) {
        let bd = new Date(p.birthdate);
        // have to remember to add 1 to getMonth() since it's zero-based
        return bd.getMonth()+1 == targetMonth;
    }
    return dictionaryList.filter(isRightMonth);
}

app.get('/people-born-in/:monthNumber', async (req, res) => {
    const monthNumber = req.params.monthNumber;
    // need to figure out flashing better. For now, just a console.log
    if( ! ( monthNumber && monthNumber >= 1 && monthNumber <= 12 )) {
        console.log("bad monthNumber", monthNumber);
        return res.send(`<em>error</em> ${monthNumber} is not valid`);
    }
    const db = await Connection.open(mongoUri, WMDB);
    const people = db.collection(PEOPLE);
    // not the most efficient approach; better to search in the database
    let all = await people.find({}).toArray();
    let chosen = peopleBornInMonth(all, monthNumber);
    let descriptions = chosen.map(personDescription);
    let now = new Date();
    let nowStr = now.toLocaleString();
    let num = descriptions.length;
    console.log('len', descriptions.length, 'first', descriptions[0]);
    return res.render('list.ejs',
                      {listDescription: `${num} people born in ${monthNames[monthNumber]}`,
                       list: descriptions});
});
    
// This gets data from the form submission and redirects to the one above
app.get('/people-born-in-month/', (req, res) => {
    let monthNumber = req.query.month;
    if( ! ( monthNumber && monthNumber >= 1 && monthNumber <= 12 )) {
        console.log("bad monthNumber", monthNumber);
        return res.send(`<em>error</em> ${monthNumber} is not valid`);
    }
    console.log('monthNumber', monthNumber, 'redirecting');
    res.redirect('/people-born-in/'+monthNumber);
});
    
app.get('/staffList/', async (req, res) => {
    const db = await Connection.open(mongoUri, WMDB);
    const staff = db.collection(STAFF);
    let all = await staff.find({}).toArray();
    let names = all.map((doc) => doc.name);
    console.log('len', all.length, 'first', all[0]);
    return res.render('list.ejs',
                      {listDescription: 'all staff',
                       list: names});
});

app.get('/menu-by-year/', async (req, res) => {
    const db = await Connection.open(mongoUri, WMDB);
    const people = db.collection(PEOPLE);
    // not the most efficient approach; better to search in the database
    let allYears = await people
        .aggregate([{$set: {birthDateObj: {$dateFromString: { dateString: "$birthdate",
                                                              format: "%Y-%m-%d",
                                                              onError: null}}}},
                    {$set: {birthYear: {$year: "$birthDateObj"}}},
                    {$project: {birthYear: 1, _id: 0}},
                    {$group: {_id: "$birthYear",
                              count: {$count: {}}}}
                   ])
        .sort({_id: 1})
        .project({_id: 1})
        .toArray();
    return res.render('yearMenu.ejs',
                      {allYears})
});

app.get('/people-born-in-year/:year', async (req, res) => {
    const db = await Connection.open(mongoUri, WMDB);
    const people = db.collection(PEOPLE);
    const year = req.params.year;
    const yearMatch = new RegExp('^'+year+'-');
    let folk = await people
        .find({birthdate: yearMatch})
        .project({nm: 1, name: 1, birthdate: 1})
        .toArray();
    let descriptions = folk.map(personDescription);
    let now = new Date();
    let nowStr = now.toLocaleString();
    let num = descriptions.length;
    console.log('len', descriptions.length, 'first', descriptions[0]);
    return res.render('list.ejs',
                      {listDescription: `${num} people born in ${year}`,
                       list: descriptions});
});

app.get('/people-born-in-year/', (req, res) => {
    res.redirect('/people-born-in-year/'+req.query.year);
});
    


// ================================================================
// postlude

const serverPort = cs304.getPort(8080);

// this is last, because it never returns
app.listen(serverPort, function() {
    console.log(`listening on ${serverPort}`);
    console.log(`visit http://cs.wellesley.edu:${serverPort}/`);
    console.log(`or http://localhost:${serverPort}/`);
    console.log('^C to exit');
});
