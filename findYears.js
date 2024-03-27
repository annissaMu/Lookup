// File to find the person with nm 123
// Scott D. Anderson and Olivia Giandrea

const path = require('path');
require("dotenv").config({ path: path.join(process.env.HOME, '.cs304env')});
const { Connection } = require('./connection');
const cs304 = require('./cs304');

const mongoUri = cs304.getMongoUri();

// Use these constants and mispellings become errors
const WMDB = "wmdb";
const PEOPLE = "people";
const STAFF = "staff";

async function years1(people) {
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
        .toArray();
    console.log(allYears.length, allYears[0]);
    return allYears;
}

async function years2(people) {
    let allYears = await people
        .aggregate([{$set: {birthDateParts: {$split: [ "$birthdate", "-" ]}}},
                    {$set: {birthYear: {$arrayElemAt: [ "$birthDateParts", 0 ]}}},
                    {$project: {birthYear: 1, _id: 0}},
                    {$group: {_id: "$birthYear",
                              count: {$count: {}}}}
                   ])
        .sort({_id: 1})
        .toArray();
    console.log(allYears.length, allYears[0]);
    return allYears;
}

async function years3(people) {
    let allBirthdays = await people
        .find({}).project({birthdate: 1}).toArray();
    let allYears = allBirthdays.map((s) => { d = new Date(s.birthdate); return d.getFullYear() });
    let yearsDict = {};
    allYears.forEach( y => {
        yearsDict[y] = y;
    });
    let distinctYears = Object.keys(yearsDict).sort((a,b) => a-b);
    return distinctYears;
}

async function main() {
    // here's the one line that does the query
    const db = await Connection.open(mongoUri, WMDB);
    const people = db.collection(PEOPLE);
    let val = await years3(people);
    console.log(val.length, val[0]);
    // val.forEach((r) => console.log(r));
    await Connection.close();
    console.log('done');
}

main();
