const SSC = require('sscjs');
const { MongoClient, MongoTopologyClosedError } = require('mongodb');
const fetch = require('node-fetch');
const { Webhook, MessageBuilder } = require('discord-webhook-node');
const { api } = require('@hiveio/hive-js');;
require('dotenv').config();

//connect to Webhook
const hook = new Webhook(process.env.DISCORD_WEBHOOK);

const dbName = 'terracore';
var client = new MongoClient(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true, serverSelectionTimeoutMS: 7000 });


//find node to use
const nodes = ["https://engine.rishipanthee.com", "https://herpc.dtools.dev", "https://api.primersion.com", "https://herpc.kanibot.com", "https://ctpmain.com", "https://he.sourov.dev", "https://he.atexoras.com:2083", "https://herpc.actifit.io", "https://ha.herpc.dtools.dev"];
var node;

async function findNode() {
    //look in mongo for last node used
    var currentNode;
    try {
        let db = client.db(dbName);
        let collection = db.collection('he-node');
        let lastNode = await collection.findOne({ "global" : { $exists: true } });
        if (lastNode) {
            currentNode = lastNode.lastnode + 1;
            if (currentNode > nodes.length - 1) {
                currentNode = 0;
            }
            //update node in mongo
            await collection.updateOne({global: true}, {$set: {lastnode: currentNode}});
        }
        else {
            currentNode = 0;
            //store node in mongo
            await collection.insertOne({global: true, lastnode: currentNode});
        }
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    }
    console.log('Current node: ' + currentNode);
    node = nodes[currentNode];
    while (true) {
        try{
            const response = await fetch(node);
            const data = await response.json();
            if (data) {
                console.log('Node is online: ' + node);
                break;
            }
            else {
                console.log('Node is offline');
                node = nodes[Math.floor(Math.random() * nodes.length)];
                console.log('Checking another node: ' + node);
            }
        }
        catch (err) {
            console.log('Node is offline');
            node = nodes[Math.floor(Math.random() * nodes.length)];
            console.log('Checking another node: ' + node);
            lastevent = Date.now();
        }
    }
  
}

async function webhook(title, message, color) {
    const embed = new MessageBuilder()
        .setTitle(title)
        .addField('Message: ', message, true)
        .setColor(color)
        .setTimestamp();
    try {
        hook.send(embed).then(() => console.log('Sent webhook successfully!'))
        .catch(err => console.log(err.message));
    }
    catch (err) {
        console.log(chalk.red("Discord Webhook Error"));
    }   
}
async function storeHash(hash, username) {
    try{
        let db = client.db(dbName);
        let collection = db.collection('hashes');
        await collection.insertOne({hash: hash, username: username, time: Date.now()});
        console.log('Hash ' + hash + ' stored');
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    }
}
async function storeRejectedHash(hash, username) {
    try{
        let db = client.db(dbName);
        let collection = db.collection('rejectedHashes');
        await collection.insertOne({hash: hash, username: username, time: Date.now()});
        console.log('Hash ' + hash + ' stored');
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    }
}
//engineering upgrade
async function engineering(username, quantity) {
    try{
        var cache  = await cacheUser(username);
        if(cache) {
            console.log(username + ' tried to upgrade engineering but is already cached');
            return false;
        }

        let db = client.db(dbName);
        let collection = db.collection('players');
        let user = await collection.findOne({ username : username });

        if (!user) {
            return true;
        }

        var cost = Math.pow(user.engineering, 2);
        var newrate = user.minerate + (user.minerate * 0.1);
        var newEngineer = user.engineering + 1;

        while (true) {
            if (quantity == cost){  
                await collection.updateOne({username: username}, {$set: {minerate: newrate, engineering: newEngineer}});
            }   
            else {
                return true;
            }

            let userCheck = await collection.findOne({ username : username });
            if (userCheck.engineering == newEngineer && userCheck.minerate == newrate) {
                await webhook('Engineering Upgrade', username + ' has upgraded their engineering to ' + newEngineer, '#86fc86')
                return true;
            }
            else {
                console.log('Engineering upgrade failed for ' + username);
            }
        }
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            webhook('Error', 'Error upgrading engineering for ' + username + ' ' + err, '#ff0000');
        }
    }
    finally {
        await clearCache(username);
        return true;
    }

}
//defense upgrade
async function defense(username, quantity) {
    try{
        var cache  = await cacheUser(username);
        if(cache) {
            console.log(username + ' tried to upgrade defense but is already cached');
            return false;
        }

        let db = client.db(dbName);
        let collection = db.collection('players');
        let user = await collection.findOne({ username : username });

        if (!user) {
            return true;
        }

        while (true) {
            let cost = Math.pow(user.defense/10, 2);
            var newDefense = user.defense + 10;
            if (quantity == cost){
                await collection.updateOne({username : username}, {$set: {defense: newDefense}}); 
            }
            else {
                return true;
            }

            let userCheck = await collection.findOne({ username : username });
            if (userCheck.defense == newDefense) {
                webhook('Upgrade', username + ' upgraded defense to ' + newDefense, '#86fc86');
                return true;
            }
            else {
                console.log('Defense upgrade failed for ' + username);
            }
        
        }
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    }
    finally {
        await clearCache(username);
        return true;
    }
}
//damage upgrade
async function damage(username, quantity) {
    try{
        var cache  = await cacheUser(username);
        if(cache) {
            console.log(username + ' tried to upgrade damage but is already cached');
            return false;
        }

        let db = client.db(dbName);
        let collection = db.collection('players');
        let user = await collection.findOne({ username : username });

        if (!user) {
            return true;
        }

        while (true) {
            var cost = Math.pow(user.damage/10, 2);
            var newDamage = user.damage + 10;

            if (quantity == cost){
                await collection.updateOne({username: username}, {$set: {damage: newDamage}});
            }
            else {
                return true;
            }

            let userCheck = await collection.findOne({ username : username });
            if (userCheck.damage == newDamage) {
                webhook('Upgrade', username + ' upgraded damage to ' + newDamage, '#86fc86');
                return true;
            }
        }
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    }
    finally {
        await clearCache(username);
        return true;
    }

}
//contributor upgrade
async function contribute(username, quantity) {
    try{
        var cache  = await cacheUser(username);
        if(cache) {
            console.log(username + ' tried to upgrade contributor but is already cached');
            return false;
        }

        let db = client.db(dbName);
        let collection = db.collection('players');
        let user = await collection.findOne({username: username});

        //check if user exists
        if (!user) {
            return true;
        }

        //check starting favor
        let startFavor = user.favor;
        while (true) {
            var qty = parseFloat(quantity);
            var newFavor = user.favor + qty;

            await collection.updateOne({username: username}, {$set: {favor: newFavor}});

            var userCheck = await collection.findOne({ username : username });
            if (userCheck.favor == startFavor + qty) {
                webhook("New Contribution", "User " + username + " contributed " + qty.toString() + " favor", '#c94ce6')
                var stats = db.collection('stats');
                var globalFavor = await stats.findOne({date: "global"});
                var newGlobalFavor = globalFavor.currentFavor + qty;
                await stats.updateOne({date: "global"}, {$set: {currentFavor: newGlobalFavor}});
                return true;
            }
            
        }
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    }
    finally {
        await clearCache(username);
        return true;
    }

}


//////////////////////////////////////////////////////////////////////////////
////NFT FUNCTIONS/////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//THESE ARE TEST FUNCTIONS FOR THE NFT MARKETPLACE IF YOU SEND SCRAP BEFORE LAUNCH YOU WILL LOOSE THE NFTS THAT POPULATE
async function buy_crate(owner, quantity){
    try{
        //load crate collection
        let db = client.db(dbName); 
        var collection = db.collection('crates');


        //check quantity sent if 25 SCRAP == common chest 50 SCRAP == uncommon chest
        if (quantity == 0.1){
            var rarity = 'common';
        }
        else if (quantity == 0.2){
            var rarity = 'uncommon';
        }
        else {
            return;
        }

        //create crate object
        let crate = new Object();
        crate.name = rarity.charAt(0).toUpperCase() + rarity.slice(1) + ' Loot Crate';
        crate.rarity = rarity;
        crate.owner = owner;
        crate.item_number = await collection.countDocuments() + 1;
        crate.image = "https://terracore.herokuapp.com/images/" + rarity + '_crate.png';
        //add market object to crate
        let market = new Object();
        market.listed = false;
        market.price = 0;
        market.seller = null;
        market.created = 0;
        market.expires = 0;
        market.sold = 0;

        //add market object to crate
        crate.market = market;

        //add crate to database
        collection.insertOne(crate);
        console.log('Create Purchaed: ' + crate.name + ' with rarity: ' + crate.rarity + ' with owner: ' + crate.owner + ' with item number: ' + crate.item_number);
        //send webhook to discord
        webhook('New Crate Purchase', 'New crate purchased by ' + owner + ' with rarity: ' + crate.rarity, ' for ' + quantity + ' SCRAP', '#86fc86');
    }
    catch(err){
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection is closed');
            process.exit(1);
        }
        else{
            console.log(err);
        }
    }
}

//////////////////////////////////////////////////////////////////////////////
////QUE AND SEND TRANSACTIONS/////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////
//create a function where you can send transactions to be queued to be sent
async function sendTransaction(username, quantity, type, hash){
    try{
        let db = client.db(dbName);
        let collection = db.collection('he-transactions');
        let result = await collection.insertOne({username: username, quantity: quantity, type: type, hash: hash, time: new Date()});
        console.log('Transaction ' + result.insertedId + ' added to queue');
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    } 
}
//create a function that can be called to send all transactions in the queue
async function sendTransactions() {
    try{
        let db = client.db(dbName);
        let collection = db.collection('he-transactions');
        let transactions = await collection.find({}).toArray();
        for (let i = 0; i < transactions.length; i++) {
            let transaction = transactions[i];
            if(transaction.type == 'engineering') {
                var result = await engineering(transaction.username, transaction.quantity);
                if (result) {
                    await storeHash(transaction.hash, transaction.username);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'contribute') {
                var result = await contribute(transaction.username, transaction.quantity);
                if (result) {
                    await storeHash(transaction.hash, transaction.username);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'defense') {
                var result = await defense(transaction.username, transaction.quantity);
                if (result) {
                    await storeHash(transaction.hash, transaction.username);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'damage') {
                var result = await damage(transaction.username, transaction.quantity);
                if (result) {
                    await storeHash(transaction.hash, transaction.username);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else if (transaction.type == 'buy_crate') {
                var result = await buy_crate(transaction.username, transaction.quantity);
                if (result) {
                    await storeHash(transaction.hash, transaction.username);
                    await collection.deleteOne({_id: transaction._id});
                }
            }
            else{
                console.log('unknown transaction type');
                await collection.deleteOne({_id: transaction._id});
            } 
        }
        return true;
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
            return true;
        }
    }
}
//call send transactions and wait for it to return true then call check transactions
async function checkTransactions() {
    //console.log('Checking transactions');
    let done = await sendTransactions();
    if(done) {
        setTimeout(checkTransactions, 1000);
    }
}

//creatre function to cache a user
async function cacheUser(username) {
    try{
        var db = client.db(dbName);
        const cache = await db.collection('cached').find({username: username}).limit(1).next();
        if (cache) {
            //check to see if user has been in cache for more than 5 seconds
            if (cache.timestamp < (Date.now() - 5000)) {
                //remove user from cache
                await db.collection('cached').deleteOne({username: username});
            }
            console.log("User in Cache...Skipping");
            return true;
        } 
        //add username to cache
        await db.collection('cached').updateOne({username: username}, {$set: {username: username, timestamp: Date.now()}}, {upsert: true})
        return false;
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
            return false;
        }
    }
}

//create a function to clear user from cache
async function clearCache(username) {
    try{
        var db = client.db(dbName);
        await db.collection('cached').deleteOne({username: username});
    }
    catch (err) {
        if(err instanceof MongoTopologyClosedError) {
            console.log('MongoDB connection closed');
            process.exit(1);
        }
        else {
            console.log(err);
        }
    }
}



var lastevent = Date.now();
//aysncfunction to start listening for events
async function listen() {
    await findNode();
    checkTransactions();
    const ssc = new SSC(node);
    ssc.stream((err, res) => {
        lastevent = Date.now();
        if (res['transactions']) {
            //loop through transactions and look for events
            try{
                for (var i = 0; i < res['transactions'].length; i++) {
                    //check if contract is token
                    if (res['transactions'][i]['contract'] == 'tokens' && res['transactions'][i]['action'] == 'transfer') {
                        //convert payload to json
                        var payload = JSON.parse(res['transactions'][i]['payload']);
                        //check if to is "null" which is burn address
                        if (payload.to == 'null' && payload.symbol == 'SCRAP') {
                            //get memo 
                            var memo = {
                                event: payload.memo.split('-')[0],
                                hash: payload.memo.split('-')[1],
                            }
                            var from = res['transactions'][i]['sender'];
                            var quantity = payload.quantity;
                            var hashStore = payload.memo;

                            if (res['transactions'][i].logs.includes('errors')) {
                                storeRejectedHash(hashStore, from);
                                return;
                            }

                            //check if memo is engineering
                            if (memo.event == 'terracore_engineering'){
                                sendTransaction(from, quantity, 'engineering', hashStore);
                                return;
                            }
                            else if (memo.event == 'terracore_damage'){
                                sendTransaction(from, quantity, 'damage', hashStore);
                                return;
                            }
                            else if (memo.event == 'terracore_defense'){
                                sendTransaction(from, quantity, 'defense', hashStore);
                                return;
                            }
                            else if (memo.event == 'terracore_contribute'){
                                sendTransaction(from, quantity, 'contribute', hashStore);
                                return;
                            }
                            else if (memo.event == 'tm_buy_crate'){
                                sendTransaction(from, quantity, 'buy_crate', hashStore);
                                return;
                            }

                            else{
                                console.log('Unknown event');
                                return;
                            }
                                       
                        }

                    }
                    else if (res['transactions'][i]['contract'] == 'tokens' && res['transactions'][i]['action'] == 'stake') {
                        //convert payload to json
                        var payload = JSON.parse(res['transactions'][i]['payload']);

                        //check if symbol is scrap
                        if (payload.symbol == 'SCRAP') {
                            var sender = res['transactions'][i]['sender'];
                            var qty = payload.quantity;
                            var hashStore = payload.memo;
                            if (res['transactions'][i].logs.includes('errors')) {
                                storeRejectedHash(hashStore, sender);
                                return;
                            }
                            webhook('New Stake', sender + ' has staked ' + qty + ' ' + "SCRAP", '#FFA500');
                            storeHash(hashStore, sender);
                            return;
                        }


                    }
                }
            }
            catch(err){
                console.log(err);
            }
        }
        else {
            console.log('No transactions');
        }

    });
}


listen();
lastevent = Date.now();
//kill process if no events have been received in 30 seconds
setInterval(function() {
    console.log('Last event: ' + (Date.now() - lastevent) + ' ms ago');
    if (Date.now() - lastevent > 60000) {
        console.log('No events received in 60 seconds, shutting down so pm2 can restart');
        process.exit(1);
    }
}, 1000);




