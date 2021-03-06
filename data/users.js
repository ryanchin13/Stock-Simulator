const mongoCollections = require('../config/mongoCollections');
const users = mongoCollections.users;
const bcrypt = require('bcrypt');
const saltRounds = 12;
const validation = require("../validation.js");
const { ObjectId } = require("mongodb");

/*
    Gets user by id
*/
async function getUserById(id) {
    // validate inputs
    validation.checkId(id);

    // format inputs
    id = id.trim();

    // get user from collection
    const userCollection = await users();
    const user = await userCollection.findOne({ _id: ObjectId(id) });
    if (!user) throw `No user found with id ${id}`;

    return user;
} 


/*
    Creates a user
*/
async function createUser(username, password) {
    //Ensures no errors in email/username/password entry. 
    validation.checkUsername(username);
    validation.checkPassword(password);
    
    // format inputs
    username = username.trim().toLowerCase();
    password = password.trim();

    // get users collection
    const userCollection = await users();

    // check for duplicate usernames
    const test = await userCollection.findOne({ username: username });
    if(test!==null) throw 'Error: there is already a user with the given username';

    // password hash
    const hashPassword = await bcrypt.hash(password, saltRounds);

    //starts a new user off with $10,000
    let newUser = {
        "username": username,
        "password": hashPassword,
        "cash": 10000,
        "efficiency": 0,
        "stocks": []
    }

    // add user to database
    const insertInfo = await userCollection.insertOne(newUser);
    if (insertInfo.insertInfo === 0) throw 'Could not add user';
    return { userCreated: true }; // return an insert confirmation
}


/*
    Gets user by username
*/
async function getUser(username) {
    // validate inputs
    validation.checkUsername(username);
    
    // format inputs
    username = username.trim().toLowerCase();

    // get user collection
    const userCollection = await users();

    // get user
    const user = await userCollection.findOne({ username: username });
    if(user === null) throw `No user found with username ${username}`;
    return user;
}


/*
    Authenticates a user given username and password
*/
async function checkUser(username, password) {
    // validate inputs
    validation.checkUsername(username);
    validation.checkPassword(password);

    // format inputs
    username = username.trim().toLowerCase();
    password = password.trim();

    // get users collection
    const userCollection = await users();

    // try to get user
    const user = await userCollection.findOne({ username: username });
    if(user === null) throw 'Either the username or password is invalid'; 
    const compare = await bcrypt.compare(password, user.password); // check if hashed password matches
    if(!compare) throw 'Either the username or password is invalid';
    return { authenticated: true }; // authenticate
}


/*
    Gets all users currently in the database
*/
async function getAllUsers() {
    // get users collection
    const userCollection = await users();

    // get list of users
    const userList = await userCollection.find({}).toArray();
    if (!userList) throw 'Could not get all users';
    return userList; // reverted back to this for now
    // return userList.sort((x,y) => (x.cash > y.cash) ? -1 : ((y.cash > x.cash) ? 1 : 0)); // return user list sorted in decending order by cash
}


/*
    Updates a user's password
*/
async function updateUser(username, newPassword) {
    //validate inputs
    validation.checkUsername(username);
    validation.checkPassword(newPassword);

    //get user
    let updatedUser = await getUser(username);
    
    //hash new password
    const hashPassword = await bcrypt.hash(newPassword, saltRounds);

    //replace old with new
    updatedUser.password = hashPassword;
    
    const userCollection = await users();

    //update
    const updatedInfo = await userCollection.updateOne(
        { username: username },
        { $set: updatedUser }
    );
    if (updatedInfo.modifiedCount !== 1) throw "Failed to update user"
    return;
}

module.exports = {
    getUserById,
    createUser,
    checkUser,
    getUser,
    checkUser,
    getAllUsers,
    updateUser
};