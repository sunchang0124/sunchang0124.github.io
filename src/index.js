// First version was made on 08/06/2020 - 14/06/2020
import auth from "solid-auth-client";
import { fetchDocument, createDocument } from 'tripledoc';
import { solid, schema, space, rdf, foaf, acl, skos, dc, dct, vcard} from 'rdf-namespaces';

import data from "@solid/query-ldflex";
import { literal, namedNode } from "@rdfjs/data-model";
const Docker = require('node-docker-api').Docker;
const tar = require('tar-stream');

// Global variables
var registerFileURL = "https://chang.inrupt.net/registerlist/requestlist.ttl";
var registerParticipationFolder = "https://chang.inrupt.net/registerlist/participationlist/";
var registerTriggerMessageURL = "https://chang.inrupt.net/inbox/triggermessage.ttl";
var podServerURL = "https://chang.inrupt.net/profile/card#me";
var registerIndexRef = "https://chang.inrupt.net/settings/registerIndex.ttl";
var userRegisterRef = "https://chang.inrupt.net/registerlist/userregister.ttl"

// query all button values
const btns = document.querySelectorAll(".listen.button");
const btn_login = document.querySelectorAll(".login.button");
const searchIcons= document.querySelectorAll(".link");

// request page show all existing data request
var page = window.location.pathname.split("/").pop();
if (page === "participate.html"){
  // const registerFileURL = "https://chang.inrupt.net/registerlist/requestlist.ttl";
  fetchRequestURL(registerFileURL).then(fetchRegisterRecord => {
    fetchRegisterList(fetchRegisterRecord).then(fetchedRequestAndWebId =>{

      const requestURIList = fetchedRequestAndWebId[0]
      const requestWebIdDocList = fetchedRequestAndWebId[1]
      const requestProfileIdList = fetchedRequestAndWebId[2]

      plotCardsOnPage(requestWebIdDocList, requestProfileIdList, requestURIList, "fromPageEntrance", "participant").then(outcome => {
        respondToRequest(outcome[0], outcome[1]);
      });
    });
  });
}else if (page === "yourRequest.html"){
  getWebId().then(profileWebID => {
    getRequestList(profileWebID).then(fetchedRequestListRef => {
      const findAllSubjects = fetchedRequestListRef.findSubjects(rdf.type, "http://schema.org/AskAction");

      fetchRequestURL(profileWebID).then(webIdDoc => {
        plotCardsOnPage(webIdDoc, profileWebID, findAllSubjects, "fromWebID", "requester").then(outcome => {
          respondToRequest(outcome[0], outcome[1]);
        });
      });
    }).catch((err)=> {alert(err.message);});
  });
}else if (page === "podProvider.html"){
  let timerId = setTimeout(function tick() {
    getWebId().then(profileWebID => {
      if (profileWebID === podServerURL){
        podProviderInboxList(registerTriggerMessageURL).then(statusOutput=>{
          alert(statusOutput);
          timerId = setTimeout(tick, 3000);
        });
      }
    });
  }, 3000);
}else if (page === "dockerTest.html"){
  
  const promisifyStream = (stream) => new Promise((resolve, reject) => {
    stream.on('data', (d) => console.log(d.toString()))
    stream.on('end', resolve)
    stream.on('error', reject)
  })
  
  const docker = new Docker({ socketPath: '/var/run/docker.sock' });
  // const docker = new Docker({host: 'http:/v1.40'});

  docker.info().then(alert("done"));
  // docker.image.create({}, { fromImage: 'ubuntu' })
  //   .then(stream => promisifyStream(stream))
  //   .then(() => docker.image.get('ubuntu').status())
  //   .then(image => image.history())
  //   .then(events => console.log(events))
  //   .catch(error => console.log(error))
}


async function addObjectFunction(subject, predicate, object){
  await data[subject][predicate].add(object);
}

async function resultSending(singleRequesterWebID, singleRequestURL, serverInboxStatus, finalResult){
  // Update to server inbox
  await data[serverInboxStatus.asRef()][rdf.type].set(namedNode(schema.DeactivateAction));

  // Send to requester inbox
  const singleRequesterInbox = singleRequesterWebID.split("profile/card#me")[0] + "inbox/" + singleRequestURL.split("#")[1] + ".ttl";
  data[singleRequesterInbox].put();
  await data[singleRequesterInbox][rdf.type].add(namedNode(schema.resultComment));
  const currentDateTime = new Date(Date.now())
  await data[singleRequesterInbox][schema.dateCreated].add(literal(currentDateTime.toISOString(), "http://www.w3.org/2001/XMLSchema#dateTime"));
  await data[singleRequesterInbox][schema.result].add(literal(finalResult));

  return "Sending results is successful!"
}

async function podProviderInboxList(registerTriggerMessageURL){
  const inboxListOrderDoc = await fetchDocument(registerTriggerMessageURL);
  const inboxListOrderSubjects = inboxListOrderDoc.findSubjects(rdf.type, schema.ActivateAction); //DeactivateAction
  // const requesterProfileWebID = [];
  // const requesterWebIdDoc = []
  // const requestTriples = [];
  if (inboxListOrderSubjects.length == 0){
    return "No analysis trigger message needs to be processed!";
  }else{
    for (let i=0;i<inboxListOrderSubjects.length;i++){

      const singleRequestURL = inboxListOrderSubjects[i].getRef(schema.target);
      const singleRequesterWebID = inboxListOrderSubjects[i].getRef(schema.creator);

      const registerResponseFileURL = registerParticipationFolder + singleRequestURL.split("#")[1] + '.ttl';
      
      fetchRequestURL(singleRequestURL.split("#")[0]).then(fetchedRequestListRef=> {
          validationProcess(fetchedRequestListRef, singleRequestURL, singleRequesterWebID).then(validationOutcome=> {
          if (validationOutcome){
            let requestDataSum = 0;
            let requestDataList = [];
            const requestDataItem = fetchedRequestListRef.getSubject(singleRequestURL).getRef(schema.DataFeedItem);

            fetchRequestURL(registerResponseFileURL).then(fetchedRegisterResponseFile=> {
              // Find all participants response who participate the request
              const allResponsesSubjects = fetchedRegisterResponseFile.findSubjects()
              const uniqueResponsesSubjects = [];
              for (let i=0; i<allResponsesSubjects.length; i++){
                // Here should add participant's credential verification!
                if (!uniqueResponsesSubjects.includes(allResponsesSubjects[i])){
                  uniqueResponsesSubjects.push(allResponsesSubjects[i]);
                }
              }
                
              for (let i = 0; i < uniqueResponsesSubjects.length; i++){
                if (uniqueResponsesSubjects[i].getRef("http://schema.org/RsvpResponseYes") === singleRequestURL){
                  const participantWebId = uniqueResponsesSubjects[i].getRef(schema.participant);  
                  const participatePeriod = uniqueResponsesSubjects[i].getDateTime(schema.endDate);  

                  if (participatePeriod > new Date(Date.now())){
                    // fetch each participant's healthcondition.ttl
                    fetchRequestURL(participantWebId.split('profile')[0]+'private/healthrecord.ttl').then(fetchedParticipantData=> {
                      // get the latest age data
                      const fetchedParticipantTriple = fetchedParticipantData.getTriples();
                      for (let j = 0; j < fetchedParticipantTriple.length; j++){
                        if (fetchedParticipantTriple[j].predicate.id === requestDataItem){
                          requestDataSum += parseInt(fetchedParticipantTriple[j].object.value);
                          requestDataList.push(parseInt(fetchedParticipantTriple[j].object.value));
                          // Print the results at the end
                          if (i==uniqueResponsesSubjects.length-1 && j==fetchedParticipantTriple.length-1){
                            const finalResult = (requestDataSum/requestDataList.length);
                            console.log(finalResult)
                            resultSending(singleRequesterWebID, singleRequestURL, inboxListOrderSubjects[i], finalResult).then(status=>{
                              return status;
                            });
                          }
                        }
                      }
                    }).catch((err)=> {return err.message;});
                  }else{return "Participation period of "+ uniqueResponsesSubjects[i].toString + " has expired!"}
                  }// }).catch((err)=> {alert(err.message);});
              }
            });
          }else{return "Request validation is failed. Process is interrupted!"}
        });
      });
    }
  }

  // plotCardsOnPage(requesterWebIdDoc, requesterProfileWebID, requestTriples, "fromPodProviderInbox", "podProvider").then(outcome => {
  //   const finalResult = respondToRequest(outcome[0], outcome[1]);
  //   console.log(inboxListOrderSubjects.asRef());
  //   await data[inboxListOrderSubjects.asRef()][schema.result].add(literal(finalResult));
  // });
}


// ****** Log In and Log Out *********//
async function getWebId() {

  /* 1. Check if we've already got the user's WebID and access to their Pod: */
  let session = await auth.currentSession();
  if (session) {
    return session.webId;
  }
  else{
    /* 2. User has not logged in; ask for their Identity Provider: */
    const identityProvider = await getIdentityProvider();

    /* 3. Initiate the login process - this will redirect the user to their Identity Provider: */
    auth.login(identityProvider);
  }
}

// login using inrupt or solid community identity providers 
function getIdentityProvider() {
  const idpPromise = new Promise((resolve, _reject) => {
    btns.forEach(function(btn) {
      btn.addEventListener("click", function(e){
        e.preventDefault();
        const styles = e.currentTarget.classList;
        
        if (styles.contains('inrupt')) {
          resolve("https://inrupt.net");
          console.log("Login Inrupt");
        }
        else if (styles.contains('solid')) {
          resolve("https://solid.community");
          console.log("Login Solid Community");
        }
      });
    });
  });
  return idpPromise
}

getWebId().then(webId => {

  const homeMessageElement = document.getElementById("homeMessage");
  if (webId){
    if (window.location.pathname == "/dist/login.html"){window.location.href = "homepage.html";}
    if (homeMessageElement){homeMessageElement.textContent = "Welcome! "+ webId;}

    document.getElementById("logStatusPage").textContent = "Log Out";
    document.getElementById("logStatusFollowing").textContent = "Log Out";

    // ***** Log out ***** //
    btn_login.forEach(function(btn) {
      btn.addEventListener("click", function(e){
        e.preventDefault();
        const styles = e.currentTarget.classList;
        if (styles.contains('login')) {
          auth.logout().then(()=> alert('See you soon!'))
          window.location.href = "homepage.html";
        }
      });
    });
  }
  else{
    if (homeMessageElement){homeMessageElement.textContent = "Contribute your data in SOLID to research with full control and privacy preserved."}
    document.getElementById("logStatusPage").textContent = "Log In";
    document.getElementById("logStatusFollowing").textContent = "Log In";
  }
});


// ****** Fetch data from Pod *********//
async function getTriplesObjects(fetchFrom, fetchSubject, fetchPredicate, option) {

  /* 1. Fetch the Document at `webId`: */
  try{
    const fetchFromDoc = await fetchDocument(fetchFrom);
  }
  catch(err) {
    alert(err.message) ;
  }
  finally{

    const fetchFromDoc = await fetchDocument(fetchFrom);

    if (option){
      /* 2. Read the Subject representing the current user's profile: */
      const getTriples = fetchFromDoc.getTriples();
      return getTriples
    }
    
    else{
      /* 3. Get their triples or objects */
      const getSubject = fetchFromDoc.getSubject(fetchSubject);
      if (fetchPredicate) {
        const getObjects = getSubject.getAllLiterals(fetchPredicate).concat(getSubject.getAllRefs(fetchPredicate));
        return getObjects
      }
      else{
        const getObjects = getSubject.getTriples()
        return getObjects
      }
    }
  }
}


// ****** Generate table *********//
function generateTableHead(table, data) {
  let thead = table.createTHead();
  let row = thead.insertRow();
  for (let key of data) {
    let th = document.createElement("th");
    let text = document.createTextNode(key);
    th.appendChild(text);
    row.appendChild(th);
  }
}

function generateTable(table, data) {
  for (let element of data) {
    let row = table.insertRow();
    for (let key in element) {
      let cell = row.insertCell();
      let text = document.createTextNode(element[key]);
      cell.appendChild(text);
    }
  }
}

function printTable(table, tripleResults, append) {
  let data = Object.keys(tripleResults[0]);
  if (!append){
    while(table.hasChildNodes()){table.removeChild(table.firstChild);}
  }
  if (!table.hasChildNodes()){
    generateTableHead(table, data);
  }
  generateTable(table, tripleResults);
}


// ****** Setting up a creating data model *********//
async function getNotesList(profileHead, fileLocation, fileName) {
  const fetchProfile = profileHead + "profile/card#me";
  const webIdDoc = await fetchDocument(fetchProfile);
  const profile = webIdDoc.getSubject(fetchProfile);

  /* 1. Check if a Document tracking our notes already exists. */
  if (fileLocation.includes("public")){
    var pubPriTypeIndexRef = profile.getRef(solid.publicTypeIndex);
    var predicateIndex =  "public/" + fileName;
  }
  else if (fileLocation.includes("private")){
    var pubPriTypeIndexRef = profile.getRef(solid.privateTypeIndex);
    var predicateIndex =  "private/" + fileName;
  }

  const pubPriTypeIndex = await fetchDocument(pubPriTypeIndexRef); 
  const notesListEntry = pubPriTypeIndex.findSubject(solid.instance, profileHead+predicateIndex);//schema.TextDigitalDocument

  /* 2. If it doesn't exist, create it. */
  if (notesListEntry === null) {
    // We will define this function later:
    return initialiseNotesList(profile, pubPriTypeIndex, predicateIndex).then(()=> alert("New file "+predicateIndex+" is created!"));
  }

  /* 3. If it does exist, fetch that Document. */
  const notesListRef = notesListEntry.getRef(solid.instance);

  return await fetchDocument(notesListRef);
}


async function initialiseNotesList(profile, typeIndex, predicateIndex) {
  // Get the root URL of the user's Pod:
  const storage = profile.getRef(space.storage);

  // Decide at what URL within the user's Pod the new Document should be stored:
  const notesListRef = storage + predicateIndex;

  // Create the new Document:
  const notesList = createDocument(notesListRef);
  await notesList.save();

  // Store a reference to that Document in the public Type Index for `schema:dataFeedElement`:
  const typeRegistration = typeIndex.addSubject();
  typeRegistration.addRef(rdf.type, solid.TypeRegistration)
  typeRegistration.addRef(solid.instance, notesList.asRef())
  typeRegistration.addRef(solid.forClass, schema.dataFeedElement)
  await typeIndex.save([ typeRegistration ]);

  // And finally, return our newly created (currently empty) notes Document:
  return notesList;
}

// Add note in the file 
async function addNote(profileHead, addedTableDict, notesList) {

  const fetchProfile = profileHead + "profile/card#me";
  // Initialise the new Subject:
  const newDataElement = notesList.addSubject();
  // Indicate that the Subject is a schema:dataFeedElement:
  newDataElement.addRef(rdf.type, schema.dataFeedElement);
  // Set the Subject's `schema:text` to the actual note contents:
  // Store the date the note was created (i.e. now):
  newDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));
  
  newDataElement.addRef(schema.creator, fetchProfile);

  for (let i=0; i<addedTableDict.length; i++){
    let predicateItem = addedTableDict[i].Predicate
    let objectItem = addedTableDict[i].Object
    if (Number(objectItem)){
      if (Number(objectItem) === parseInt(objectItem, 10)){
        newDataElement.addInteger(predicateItem, parseInt(objectItem));
      }
      else{
        newDataElement.addDecimal(predicateItem, parseFloat(objectItem));
      }
    }
    else if (objectItem.includes("http://") || objectItem.includes("https://")){
      newDataElement.addRef(predicateItem, objectItem);
    }
    else {
      try{
        newDataElement.addDateTime(predicateItem, new Date(objectItem));
      }catch{
        newDataElement.addString(predicateItem, objectItem);
      }
    };
  }
  const success = await notesList.save([newDataElement]);


  return success;
}

// ******************* //
// Register a new user //
// ******************* //
import { sign } from "tweetnacl";
import {
  decodeUTF8,
  encodeUTF8,
  encodeBase64,
  decodeBase64
} from "tweetnacl-util";
import { final } from "rdf-namespaces/dist/wf";

async function generatePublicKeyPair(fetchProfile, userName, affiliance) {

  const webIdDoc = await fetchDocument(fetchProfile);
  const profile = webIdDoc.getSubject(fetchProfile);

  /* 1. Check if a Document tracking our notes already exists. */
  const privateTypeIndexRef = profile.getRef(solid.privateTypeIndex);
  const privateTypeIndex = await fetchDocument(privateTypeIndexRef); 
  const userAuthEntryList = privateTypeIndex.findSubjects(solid.forClass, schema.RegisterAction);//schema.TextDigitalDocument

  /* 2. If it doesn't exist, create it. */
  if (userAuthEntryList.length == 0) {
    initialiseRegisteredUser(profile, privateTypeIndex, userName, affiliance).then(response => {
      alert(response)
      return response;
    });
  }
  else{
    return "You have registered already!"
  }
}

async function initialiseRegisteredUser(profile, typeIndex, userName, affiliance) {

  // Generate public-private key pairs
  const publicPrivateKeyPair = sign.keyPair();
  const publicKey = encodeBase64(publicPrivateKeyPair.publicKey);
  const privateKey = encodeBase64(publicPrivateKeyPair.secretKey);

  // Get the root URL of the user's Pod:
  const storage = profile.getRef(space.storage);

  // Create the new Document:
  const registerList = createDocument(storage + 'private/registration.ttl');
  const registerUser = registerList.addSubject();
  registerUser.addRef(rdf.type, schema.RegisterAction);
  registerUser.addString(schema.name, userName);
  registerUser.addString(schema.affiliation, affiliance);
  registerUser.addString("http://schema.org/hasCredential", privateKey);
  await registerList.save([registerUser]);

  // Add public key to app server pod
  await data[userRegisterRef+'#'+ storage + 'profile/card#me']["http://schema.org/hasCredential"].add(literal(publicKey));

  // Store a reference to that Document in the public Type Index for `schema:dataFeedElement`:
  const typeRegistration = typeIndex.addSubject();
  typeRegistration.addRef(rdf.type, solid.TypeRegistration);
  typeRegistration.addRef(solid.instance, registerList.asRef());
  typeRegistration.addRef(solid.forClass, schema.RegisterAction);
  await typeIndex.save([ typeRegistration ]);
  return "Successfully registered!";
}

// **************** //
// Create a request //
// **************** //
async function getRequestList(fetchProfile) {

  const webIdDoc = await fetchDocument(fetchProfile);
  const profile = webIdDoc.getSubject(fetchProfile);

  /* 1. Check if a Document tracking our notes already exists. */
  const publicTypeIndexRef = profile.getRef(solid.publicTypeIndex);
  const publicTypeIndex = await fetchDocument(publicTypeIndexRef); 
  const requestListEntryList = publicTypeIndex.findSubjects(solid.forClass, "http://schema.org/AskAction");//schema.TextDigitalDocument

  if (requestListEntryList.length > 0) {
    for (let i=0;i<requestListEntryList.length;i++){
      const requestListRef = requestListEntryList[i].getRef(solid.instance);
      if (requestListRef){
        if (requestListRef.toString()===fetchProfile.slice(0, fetchProfile.length-15)+'public/request.ttl'){
          return await fetchDocument(requestListRef);
        }
      }
    }
  }/* 2. If it doesn't exist, create it. */
  return initialiseRequestList(profile, publicTypeIndex).then(()=> {
    alert("New file 'public/request.ttl'is created!")
  });
}

async function initialiseRequestList(profile, typeIndex) {
  // Get the root URL of the user's Pod:
  const storage = profile.getRef(space.storage);

  // Decide at what URL within the user's Pod the new Document should be stored:
  const requestListRef = storage + 'public/request.ttl';

  // Create the new Document:
  const requestList = createDocument(requestListRef);
  await requestList.save();

  // Store a reference to that Document in the public Type Index for `schema:dataFeedElement`:
  const typeRegistration = typeIndex.addSubject();
  typeRegistration.addRef(rdf.type, solid.TypeRegistration)
  typeRegistration.addRef(solid.instance, requestList.asRef())
  typeRegistration.addRef(solid.forClass, "http://schema.org/AskAction")
  await typeIndex.save([ typeRegistration ]);

  // And finally, return our newly created (currently empty) notes Document:
  const firstRequestMessage = document.getElementById("firstRequestMessage");
  firstRequestMessage.textContent = "New file 'public/request.ttl' is created and initialized in your Solid Pod. -> "+ storage + 'public/request.ttl';
  return requestList;
}


// Add request to the file 
async function addRequest(fetchProfile, content, requestList) {

  // User read his signing key from his pod
  const userRegisterKeyRef = "https://"+fetchProfile.substring(fetchProfile.lastIndexOf("https://") + 8, fetchProfile.lastIndexOf("/profile/card#me"))+"/private/registration.ttl";
  const userRegisterKeyDoc = await fetchDocument(userRegisterKeyRef); 
  const userRegisterKeyTriples = userRegisterKeyDoc.getTriples();
  let privateKey = "";
  for (let i=0; i<userRegisterKeyTriples.length; i++){
    if (userRegisterKeyTriples[i].predicate.id == "http://schema.org/hasCredential"){
      privateKey = decodeBase64(userRegisterKeyTriples[i].object.value);
    }
  }

  if (privateKey.length==0){
    alert("Cannot find valid credential. Please register first!")
  }else{
    
    // Initialise the new Subject:
    var newDataElement = requestList.addSubject();
    // Indicate that the Subject is a schema:dataFeedElement:
    newDataElement.addRef(rdf.type, "http://schema.org/AskAction");
    // Set the Subject's `schema:text` to the actual note contents:
    // Store the date the note was created (i.e. now):
    
    // Use the schema as you want 
    newDataElement.addRef(schema.creator, fetchProfile);
    if (content.purpose) {newDataElement.addString("http://schema.org/purpose", content.purpose);}
    if (content.data) {
      for (let i=0; i<content.data.length; i++){
        newDataElement.addRef(schema.DataFeedItem, content.data[i]);
      } 
    }
    if (content.period) {newDataElement.addDateTime(schema.endDate, content.period);}
    if (content.numInstance) {newDataElement.addInteger("http://schema.org/collectionSize", parseInt(content.numInstance));}
    if (content.model) {newDataElement.addString("http://schema.org/algorithm", content.model);}
    const createdDate = new Date(Date.now())
    newDataElement.addDateTime(schema.dateCreated, createdDate);

    await requestList.save([newDataElement]);

    // add request to register list 
    // const registerFileURL = "https://chang.inrupt.net/registerlist/requestlist.ttl"
    const fetchRegisterLinkFile = await fetchDocument(registerFileURL)
    
    const newRegisterRecord = fetchRegisterLinkFile.addSubject();
    newRegisterRecord.addRef(schema.recordedAs, newDataElement.asRef());
    newRegisterRecord.addRef(schema.creator, fetchProfile);
    
    const requestContent = saveRequestLocally(newDataElement, content, fetchProfile, createdDate);
    const signature = sign.detached(decodeUTF8(requestContent), privateKey);
    newRegisterRecord.addString(schema.validIn, encodeBase64(signature));

    /****************   PAUSE  *****************
    //send to blockchain to get the contract
    let formdata = new FormData();

    const requestTripleString = "data:text/plain;base64," + btoa(saveRequestLocally(newDataElement, content, fetchProfile, createdDate));
    const fileTitle = newDataElement.asRef().split('#')[1];

    //Convert dataurl to file object
    const convertedFile = dataURLtoFile(requestTripleString, fileTitle+'.ttl'); 
    formdata.append("tripledatafile", convertedFile, fileTitle);
    const requestOptions = {method: 'POST', body: formdata, redirect: 'follow'};
    const response = await fetch(`https://blockchain7.kmi.open.ac.uk/rdf/merkle/list/createMerkle?token=${content.token}&title=${fileTitle}`, requestOptions)
    if (response.ok){
      const result = await response.text();
      if (result.includes('contract')){
        console.log(result);
        const contractID = result.substring(result.lastIndexOf('"contract":"') + 12,  result.lastIndexOf('","transaction":'));
        alert("Request is published and saved in the blockchain successfully! You can find it in public/request.ttl");
        newRegisterRecord.addString(schema.validIn, contractID);
      }else{alert("Your request is saved but NOT in the validation blockchain")}
    }else {alert("HTTP-Error: " + response.status);}
    ****************  PAUSE END *****************/
    
    await fetchRegisterLinkFile.save([newRegisterRecord])
    return "Thank you for posting a new data request!";
  };
}

function saveRequestLocally(newDataElement, content, fetchProfile, createdDate){

  const subject = newDataElement.asRef(); // `<${}> <${}> <${}>.\n`
  let requestTripleString = `<${subject}> <${rdf.type}> <http://schema.org/AskAction>.\n`;
  requestTripleString += `<${subject}> <http://schema.org/algorithm> "${content.model}".\n`;
  requestTripleString += `<${subject}> <http://schema.org/collectionSize> ${content.numInstance}.\n`;
  requestTripleString += `<${subject}> <${schema.creator}> <${fetchProfile}>.\n`;
  requestTripleString += `<${subject}> <${schema.dateCreated}> "${createdDate.toString().split(" (")[0]}".\n`;
  requestTripleString += `<${subject}> <${schema.endDate}> "${content.period.toString().split(" (")[0]}".\n`;
  requestTripleString += `<${subject}> <http://schema.org/purpose> "${content.purpose}".\n`;
  if (content.data) {
    for (let i=0; i<content.data.length; i++){
      requestTripleString += `<${subject}> <${schema.DataFeedItem}> <${content.data[i]}>.\n`;
    } 
  }

  return requestTripleString
}

function dataURLtoFile(dataurl, filename) {
 
  var arr = dataurl.split(','),
      mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), 
      n = bstr.length, 
      u8arr = new Uint8Array(n);
      
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  
  return new File([u8arr], filename, {type:mime});
}

async function fetchRequestURL(fetchRequest) {
  return await fetchDocument(fetchRequest)
}


// **************** //
// Create a participation //
// **************** //
async function getParticipateList(fetchProfile) {

  const webIdDoc = await fetchDocument(fetchProfile);
  const profile = webIdDoc.getSubject(fetchProfile);

  /* 1. Check if a Document tracking our notes already exists. */
  const privateTypeIndexRef = profile.getRef(solid.privateTypeIndex);
  const privateTypeIndex = await fetchDocument(privateTypeIndexRef); 
  const participateListEntryList = privateTypeIndex.findSubjects(solid.forClass, "http://schema.org/JoinAction");//schema.TextDigitalDocument

  /* 2. If it doesn't exist, create it. */
  if (participateListEntryList.length == 0) {
    initialiseParticipateList(profile, privateTypeIndex).then(participateList => {
      alert("As this is your first time to participate in a data request, we have created 'private/participation.ttl'is for you! Please approve the request again. ");
      return participateList;
    });
  }
  else{
    // 3. If it exists, fetch the participation.ttl data
    for (let i=0;i<participateListEntryList.length;i++){
      const participateListRef = participateListEntryList[i].getRef(solid.instance);
      if (participateListRef){
        if (participateListRef.toString()===fetchProfile.slice(0, fetchProfile.length-15)+'private/participation.ttl'){
          return await fetchDocument(participateListRef);
        }
      }
    }
  }
}

async function initialiseParticipateList(profile, typeIndex) {
  // Get the root URL of the user's Pod:
  const storage = profile.getRef(space.storage);

  // Decide at what URL within the user's Pod the new Document should be stored:
  const participateListRef = storage + 'private/participation.ttl';

  // Create the new Document:
  const participateList = createDocument(participateListRef);
  await participateList.save();

  // Store a reference to that Document in the public Type Index for `schema:dataFeedElement`:
  const typeRegistration = typeIndex.addSubject();
  typeRegistration.addRef(rdf.type, solid.TypeRegistration)
  typeRegistration.addRef(solid.instance, participateList.asRef())
  typeRegistration.addRef(solid.forClass, schema.JoinAction)
  await typeIndex.save([ typeRegistration ]);

  // And finally, return our newly created (currently empty) notes Document:
  return participateList;
}


// Add participation record to the file 
async function addParticipation(fetchProfile, requestList, participateRequestId, participateList, AccessControlList, collectionSize, endDate, participate_period, privacyOption) {
  // get the number of responses (participants)
  const responseSize = requestList.findSubjects(rdf.type, schema.JoinAction).length;
  // the current date
  const responseDate = new Date(Date.now());
  // get the webIDs of participants
  const responseUser = participateList.findSubjects(schema.participant, fetchProfile);
  let responseUserExisted = false;

  // check if the participant already responded to the data request
  for (let i =0;i<responseUser.length;i++){
    if (responseUser[i].getRef("http://schema.org/RsvpResponseYes") == participateRequestId){
      responseUserExisted = true;
    }
  }

  if (responseSize <= collectionSize){
    if (responseDate <= endDate){ 
      if (!responseUserExisted){
        if (participate_period >= new Date(Date.now())){
          if (!privacyOption){
            // User read his signing key from his pod
            const userRegisterKeyRef = "https://"+fetchProfile.substring(fetchProfile.lastIndexOf("https://") + 8, fetchProfile.lastIndexOf("/profile/card#me"))+"/private/registration.ttl";
            const userRegisterKeyDoc = await fetchDocument(userRegisterKeyRef); 
            const userRegisterKeyTriples = userRegisterKeyDoc.getTriples();
            let privateKey = "";
            for (let i=0; i<userRegisterKeyTriples.length; i++){
              if (userRegisterKeyTriples[i].predicate.id == "http://schema.org/hasCredential"){
                privateKey = decodeBase64(userRegisterKeyTriples[i].object.value);
              }
            }
            if (privateKey.length==0){
              alert("Cannot find valid credential. Please register first!")
            }else{

              // add participate record to participation.ttl
              const newParticipateDataElement = participateList.addSubject();
              newParticipateDataElement.addRef(rdf.type, schema.JoinAction);

              newParticipateDataElement.addRef(schema.participant, fetchProfile);
              newParticipateDataElement.addRef("http://schema.org/RsvpResponseYes", participateRequestId);
              newParticipateDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));
              newParticipateDataElement.addDateTime(schema.endDate, participate_period);


              // add participate record to Pod Server's request-response file 
              const registerRequestResponseFileURL = registerParticipationFolder + participateRequestId.split('#')[1] + ".ttl";

              /* 1. Check if a participation register list already exists. */
              const registerIndex = await fetchDocument(registerIndexRef); 
              const registerIndexEntryList = registerIndex.getSubject(registerRequestResponseFileURL).getRef(rdf.type);

              /* 2. If it doesn't exist, create it. */
              if (!registerIndexEntryList) {

                // Create the new Document
                data[registerRequestResponseFileURL].put()

                // Add record in the registerIndex.ttL
                await data[registerIndexRef+'#'+participateRequestId.split('#')[1]]["http://schema.org/RegisterAction"].add(namedNode(registerRequestResponseFileURL));
              }
              
              // 3. If it exists, add participation record in registerParticipation.ttl
              const addSubjectID =  newParticipateDataElement.asRef().split('#')[1];
              await data[registerRequestResponseFileURL+'#'+addSubjectID][rdf.type].add(namedNode(schema.JoinAction));
              await data[registerRequestResponseFileURL+'#'+addSubjectID][schema.participant].add(namedNode(fetchProfile));
              await data[registerRequestResponseFileURL+'#'+addSubjectID]["http://schema.org/RsvpResponseYes"].add(namedNode(participateRequestId));
              const currentDateTime = new Date(Date.now())
              await data[registerRequestResponseFileURL+'#'+addSubjectID][schema.dateCreated].add(literal(currentDateTime.toISOString(), "http://www.w3.org/2001/XMLSchema#dateTime"));
              await data[registerRequestResponseFileURL+'#'+addSubjectID][schema.endDate].add(literal(participate_period.toISOString(), "http://www.w3.org/2001/XMLSchema#dateTime"));
                              
              const signature = sign.detached(decodeUTF8(participateRequestId.split('#')[1]), privateKey);
              await data[registerRequestResponseFileURL+'#'+addSubjectID][schema.validIn].add(literal(encodeBase64(signature)));

              await participateList.save([newParticipateDataElement]);

              // add viewer access to the requester automatically (Users have to give control access to the application)
              const newRequestAccessControl= AccessControlList.addSubject("Read");
              // const responserWebId = requestList.getSubject(participateRequestId).getRef(schema.creator);

              newRequestAccessControl.addRef(rdf.type, acl.Authorization);
              newRequestAccessControl.addRef(acl.accessTo, "healthrecord.ttl");
              newRequestAccessControl.addRef(acl.agent, podServerURL); // Give Pod Server/Provider access to read data (responserWebId)
              newRequestAccessControl.addRef(acl.mode, acl.Read);
              newRequestAccessControl.addDateTime(schema.endDate, participate_period);
          
              const AccessControlSuccess = await AccessControlList.save([newRequestAccessControl]);
            }
          }
          
          // if it is privacy-preserving analysis
          else if (privacyOption[0]){
            // add participate record to request.ttl
            const newRequestDataElement = requestList.addSubject();
            newRequestDataElement.addRef(rdf.type, schema.JoinAction);
            
            // leave the requested data item directly without IDs
            newRequestDataElement.addInteger(privacyOption[1], privacyOption[2]);
            newRequestDataElement.addRef("http://schema.org/RsvpResponseYes", participateRequestId);
            newRequestDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));
        
            await requestList.save([newRequestDataElement]);

            // add participate record to participation.ttl
            const newParticipateDataElement = participateList.addSubject();
            newParticipateDataElement.addRef(rdf.type, schema.JoinAction);

            newParticipateDataElement.addRef(schema.participant, fetchProfile);
            newParticipateDataElement.addRef("http://schema.org/RsvpResponseYes", participateRequestId);
            newParticipateDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));
        
            await participateList.save([newParticipateDataElement]);
          }

          return true;

        }else{alert("Participation end date has to be later than today.")};
      }else{alert("You are in the participates list already.")};
    }else{alert("Sorry, request end date has expired.")};
  }else{alert("Sorry, request has enough participants.")};
}




function searchTermsNamespaces(resultObj, addTripleSearch, nameSpace){
  const getAllKeys = Object.keys(nameSpace);
      getAllKeys.forEach(function(keyName) {
        if (keyName.indexOf(addTripleSearch) !== -1) {
          resultObj.push({Text:keyName, FoundURI:nameSpace[keyName]})
        }
      });
  return resultObj
}

/**************************
 * Get all request for cards *
 **************************/
function writeAllRequest(profile, requestTriples, fetchRequest){
  let requestContent = Object();  
  let dataElementList = []

  for (let i = 0; i < requestTriples.length; i++){
    if (requestTriples[i].subject.id === fetchRequest){
      requestContent.webid = profile.asRef();
      requestContent.name = profile.getString(foaf.name);
      requestContent.organization = profile.getString("http://www.w3.org/2006/vcard/ns#organization-name");
      requestContent.image = profile.getRef(vcard.hasPhoto);

      requestContent.url = fetchRequest;
      if (requestTriples[i].predicate.id === "http://schema.org/purpose"){
        requestContent.purpose = "Purpose: "+ requestTriples[i].object.value;}
      if (requestTriples[i].predicate.id === schema.endDate){
        requestContent.period = "End date: " + requestTriples[i].object.value;}
      if (requestTriples[i].predicate.id === "http://schema.org/algorithm"){
        requestContent.analysis = "Analysis: " + requestTriples[i].object.value;}
      if (requestTriples[i].predicate.id === "http://schema.org/DataFeedItem"){
        dataElementList.push(requestTriples[i].object.value);
    }
  }
  requestContent.dataElement = "Requested data: "+ dataElementList;}
  if (Object.keys(requestContent).length < 2){
    requestContent = false;
  }
  return requestContent
}
  
/**************************
 * Generate request cards *
 **************************/
async function generateCards(requestContentList, userRole){
    
  var cleanContainer = document.getElementById("Container");
  cleanContainer.innerHTML = "";
  
  const div_cardsContainer = document.createElement("div");
  div_cardsContainer.className = "ui cards";
  div_cardsContainer.id = "cardsContainer";
  document.getElementById('Container').appendChild(div_cardsContainer);
  

  for(var i=0; i < requestContentList.length; i++){

    // Generate request cards
    const div_card = document.createElement("div");
    div_card.className = "card";
    div_card.id = "cardID"+i.toString();
    document.getElementById('cardsContainer').appendChild(div_card);
  
    const div_content = document.createElement("a");
    div_content.href = requestContentList[i].url; 
    div_content.className = "content";
    div_content.id = "contentID"+i.toString();
    document.getElementById('cardID'+i.toString()).appendChild(div_content);
  
    const div_img = document.createElement("img");
    div_img.className = "right floated mini ui image";
    div_img.src = requestContentList[i].image; //requestContentList[i].image; //
    div_img.id = "imgID"+i.toString();
    document.getElementById('contentID'+i.toString()).appendChild(div_img);
  
    const div_header = document.createElement("div");
    div_header.className = "header";
    div_header.id = "headerID"+i.toString();
    div_header.textContent = requestContentList[i].name; //"Chang Sun"
    document.getElementById('contentID'+i.toString()).appendChild(div_header);
  
    const div_meta = document.createElement("div");
    div_meta.className = "meta";
    div_meta.id = "metaID"+i.toString();
    div_meta.textContent = requestContentList[i].organization; //"IDS";
    document.getElementById('contentID'+i.toString()).appendChild(div_meta);
  
    const div_description = document.createElement("div");
    div_description.className = "description";
    div_description.id = "descriptionID"+i.toString();
    div_description.textContent = requestContentList[i].purpose; //"Purpose";
    document.getElementById('contentID'+i.toString()).appendChild(div_description);

    const div_dataElement = document.createElement("div");
    div_dataElement.style = 'word-wrap: break-word';
    div_dataElement.className = "description";
    div_dataElement.id = "dataElementID"+i.toString();
    div_dataElement.textContent = requestContentList[i].dataElement; //"Purpose";
    document.getElementById('contentID'+i.toString()).appendChild(div_dataElement);

    const div_period = document.createElement("div");
    div_period.className = "description";
    div_period.id = "periodID"+i.toString();
    div_period.textContent = requestContentList[i].period; //"period";
    document.getElementById('contentID'+i.toString()).appendChild(div_period);

    const div_analysis = document.createElement("div");
    div_analysis.className = "description";
    div_analysis.id = "analysisID"+i.toString();
    div_analysis.textContent = requestContentList[i].analysis; //"period";
    document.getElementById('contentID'+i.toString()).appendChild(div_analysis);

    const div_extra = document.createElement("div");
    div_extra.className = "extra content";
    div_extra.id = "extraID"+i.toString();
    document.getElementById('cardID'+i.toString()).appendChild(div_extra);

    if (userRole === "participant"){
      const div_forDate = document.createElement("div");
      div_forDate.className = "ui transparent input";
      div_forDate.id = "forDate"+i.toString();
      document.getElementById('extraID'+i.toString()).appendChild(div_forDate);

      const div_untilDate = document.createElement("input");
      div_untilDate.type = "date";
      div_untilDate.id = "untilDate"+i.toString();
      document.getElementById("forDate"+i.toString()).appendChild(div_untilDate);

      const div_buttons = document.createElement("div");
      div_buttons.className = "ui two buttons";
      div_buttons.id = "buttonsID"+i.toString();
      document.getElementById('extraID'+i.toString()).appendChild(div_buttons);

      const div_redButton = document.createElement("button");
      div_redButton.className = "ui basic red Decline button answer index_"+i.toString();
      div_redButton.id = "redButtonID"+i.toString();
      div_redButton.textContent = "Decline";
      document.getElementById('buttonsID'+i.toString()).appendChild(div_redButton);
    
      const div_greenButton = document.createElement("button");
      div_greenButton.className = "ui basic green Approve button answer index_"+i.toString();
      div_greenButton.id = "greenButtonID"+i.toString();
      div_greenButton.textContent = "Approve";
      document.getElementById('buttonsID'+i.toString()).appendChild(div_greenButton);
    }else{
      const percent = (Math.floor(Math.random() * 10) * 10).toString()
      const div_progress = document.createElement("div");
      div_progress.className = "ui indicating progress";
      div_progress.dataset.percent = percent;
      div_progress.id = "progressID"+i.toString();
      document.getElementById('extraID'+i.toString()).appendChild(div_progress);

      const div_progressBar = document.createElement("div");
      div_progressBar.className = "bar";
      div_progressBar.style.width = percent+'%';
      div_progressBar.style.transitionDuration = '300ms'
      div_progressBar.id = "progressBarID"+i.toString();
      document.getElementById('progressID'+i.toString()).appendChild(div_progressBar);

      const div_progressLabel = document.createElement("div");
      div_progressLabel.className = "label";
      div_progressLabel.id = "progressLabelID"+i.toString();
      div_progressLabel.textContent = "Data collection progress - " + percent+"%";
      document.getElementById('progressID'+i.toString()).appendChild(div_progressLabel);

      const div_buttons = document.createElement("div");
      div_buttons.className = "ui two buttons";
      div_buttons.id = "buttonsID"+i.toString();
      document.getElementById('extraID'+i.toString()).appendChild(div_buttons);

      if (userRole === "requester"){

        const div_regularButton = document.createElement("button");
        div_regularButton.className = "ui grey stopCollection button answer index_"+i.toString(); //rglLearning
        div_regularButton.id = "stopCollectionButtonID"+i.toString(); //regularButtonID
        div_regularButton.textContent = "Stop collection"//"Regular analysis";
        document.getElementById('buttonsID'+i.toString()).appendChild(div_regularButton);
      
        const div_privacyButton = document.createElement("button");
        div_privacyButton.className = "ui blue triggerAnalysis button answer index_"+i.toString(); //ppLearning
        div_privacyButton.id = "triggerAnalysisButtonID"+i.toString(); //privacyButtonID
        div_privacyButton.textContent = "Trigger analysis" //"Secure analysis";
        document.getElementById('buttonsID'+i.toString()).appendChild(div_privacyButton);

      }else if (userRole === "podProvider"){
        const div_privacyButton = document.createElement("button");
        div_privacyButton.className = "ui grey ppLearning button answer index_"+i.toString(); //ppLearning
        div_privacyButton.id = "privacyButtonID"+i.toString(); 
        div_privacyButton.textContent = "Abortion";
        document.getElementById('buttonsID'+i.toString()).appendChild(div_privacyButton);

        const div_regularButton = document.createElement("button");
        div_regularButton.className = "ui blue proceed button answer index_"+i.toString(); //rglLearning
        div_regularButton.id = "regularButtonID"+i.toString();
        div_regularButton.textContent = "Proceed"; //Regular analysis
        document.getElementById('buttonsID'+i.toString()).appendChild(div_regularButton);

      }
    }
    
  };
  return requestContentList;
};

async function plotCardsOnPage(webIdDoc, profileWebID, findAllSubjects, option, userRole){
  var requestContentList = [];

  if (option === "fromPageEntrance"){
    for (let i=0; i<findAllSubjects.length; i++){
      const eachProfile = webIdDoc[i].getSubject(profileWebID[i]);
      const singleRequest = writeAllRequest(eachProfile, findAllSubjects[i].fetchedRequestDoc.getTriples(), findAllSubjects[i].fetchedRequestID)
      if (singleRequest){requestContentList.push(singleRequest);}
    }
  }else if (option === "fromWebID"){
    const profile = webIdDoc.getSubject(profileWebID);
    for (let i=0; i<findAllSubjects.length; i++){
      const singleRequest = writeAllRequest(profile, findAllSubjects[i].getTriples(), findAllSubjects[i].asRef())
      if (singleRequest){requestContentList.push(singleRequest);}
    }
  // }else if (option === "fromPodProviderInbox"){
  //   for (let i=0; i<findAllSubjects.length; i++){
  //     const profile = webIdDoc[i].getSubject(profileWebID[i]);
  //     const singleRequest = writeAllRequest(profile, findAllSubjects[i].getTriples(), findAllSubjects[i].asRef())
  //     if (singleRequest){requestContentList.push(singleRequest);}
  //   }
  }else{
    const profile = webIdDoc.getSubject(profileWebID);
    const singleRequest = writeAllRequest(profile, findAllSubjects, option)
    if (singleRequest){requestContentList.push(singleRequest);}
  }

  requestContentList = await generateCards(requestContentList, userRole);

  var loader = document.getElementById("loader");
  loader.style.display = "none";

  const answer_btns = document.querySelectorAll(".answer.button");
  const outcome = [answer_btns, requestContentList]

  return outcome
}

async function fetchRegisterList(fetchRegisterRecord){
  
  const registerRecordSubjects = fetchRegisterRecord.findSubjects();
  const requestURIList = [];
  const includedRequest = [];
  const requestWebIdDocList = [];
  const requestProfileIdList = [];
  for (let i=0; i<registerRecordSubjects.length; i++){
    const registeredSingleRequestURL = registerRecordSubjects[i].getRef(schema.recordedAs);

    if (!includedRequest.includes(registeredSingleRequestURL)){
      const registeredSingleRequesterWebId = registerRecordSubjects[i].getRef(schema.creator);
      try{
        const fetchEachRequest = await fetchDocument(registeredSingleRequestURL);
        requestURIList.push({fetchedRequestID:registeredSingleRequestURL, fetchedRequestDoc:fetchEachRequest});

        requestProfileIdList.push(registeredSingleRequesterWebId);
        const webIdDoc = await fetchDocument(registeredSingleRequesterWebId);
        requestWebIdDocList.push(webIdDoc);

        includedRequest.push(registeredSingleRequestURL);
      }catch{console.log(registeredSingleRequestURL, ": cannot retrieve this data request!")}
    }
  }

  const fetchedRequestAndWebId = [requestURIList, requestWebIdDocList, requestProfileIdList];
  return fetchedRequestAndWebId
}

/*
Response to data request button
*/
function respondToRequest(answer_btns, requestContentList){
  answer_btns.forEach(function(ans_btn) {
    ans_btn.addEventListener("click", function(e){
      e.preventDefault();
      const style = e.currentTarget.classList
      // find which request the user is reponding
      const index = style.value.split(' ').pop().split('_')[1];
      const selectedRequest = requestContentList[index]; 

      // Participate in a data request
      if (style.contains('Approve')) {
        const fetchParticipateRequestId = selectedRequest.url;
        const participate_period = new Date(document.getElementById("untilDate"+index).value);
        
        getWebId().then(webId => {
          fetchRequestURL(fetchParticipateRequestId).then(fetchedRequestListRef=> {
            const collectionSize = fetchedRequestListRef.getSubject(fetchParticipateRequestId).getInteger(schema.collectionSize);
            const endDate = fetchedRequestListRef.getSubject(fetchParticipateRequestId).getDateTime(schema.endDate);
            const requestModel = fetchedRequestListRef.getSubject(fetchParticipateRequestId).getString("http://schema.org/algorithm");
  
            getParticipateList(webId).then(fetchedParticipateListRef=> {
              // if the data request is in the regular analysis mode
              if (requestModel.includes('Regular')){
                const aclDocument = webId.split("profile")[0] + "private/healthrecord.ttl.acl"
                fetchRequestURL(aclDocument).then(AccessControlList => {
                  addParticipation(webId, fetchedRequestListRef, fetchParticipateRequestId, fetchedParticipateListRef, AccessControlList, collectionSize, endDate, participate_period, requestModel.includes('Privacy')).then(success=> {
                    if (success){
                      alert("Your participation is recorded. Access to your 'healthrecord.ttl' is granted to your Pod provider.'");
                    }
                  });
                }).catch(()=> {alert("If you have given this SOLID App 'Control' Access, please turn on specific sharing for your 'healthrecord.ttl' file .");});
              }
              // if the data request is in the privacy-preserving mode
              else if (requestModel.includes('Privacy')){
                // Query the requested data item
                fetchRequestURL(fetchParticipateRequestId).then(fetchedParticipateRequest=>{
                  const requestDataItem = fetchedParticipateRequest.getSubject(fetchParticipateRequestId).getRef(schema.DataFeedItem);
                  fetchRequestURL(webId.split('profile')[0]+'private/healthrecord.ttl').then(fetchedParticipantData=> {
                    // get the latest age data
                    const fetchedParticipantTriple = fetchedParticipantData.getTriples();
        
                    for (let j = 0; j < fetchedParticipantTriple.length; j++){
                      if (fetchedParticipantTriple[j].predicate.id === requestDataItem){
                        const requestedDataResult = parseInt(fetchedParticipantTriple[j].object.value);
  
                        addParticipation(webId, fetchedRequestListRef, fetchParticipateRequestId, fetchedParticipateListRef, null, collectionSize, endDate, participate_period, [true, requestDataItem, requestedDataResult]).then(success=> {
                          if (success){
                            alert("Your participation is in privacy-preserving analysis. Nothing has been recorded except the requested data.");
                          }
                        });
                      }
                    }
                  }).catch((err)=> {alert(err.message);});
                }).catch((err)=> {alert(err.message);});
              } 
            });
          });
        });
      }else if (style.contains('triggerAnalysis')) {
        const analyzeRequest = selectedRequest.url; 
        const requestID = analyzeRequest.split("#")[1];

        // Send pod provider a trigger message
        addObjectFunction(registerTriggerMessageURL+'#'+requestID, rdf.type, namedNode(schema.ActivateAction));
        addObjectFunction(registerTriggerMessageURL+'#'+requestID, schema.target, namedNode(analyzeRequest));
        addObjectFunction(registerTriggerMessageURL+'#'+requestID, schema.creator, namedNode(selectedRequest.webid));
        const currentDateTime = new Date(Date.now())
        addObjectFunction(registerTriggerMessageURL+'#'+requestID, schema.dateCreated, literal(currentDateTime.toISOString(), "http://www.w3.org/2001/XMLSchema#dateTime"));

        addObjectFunction(analyzeRequest, schema.status, namedNode(schema.ActivateAction));

        alert("Got it! Your analysis request has been sent to the Pod Serve!")
      }else if (style.contains('proceed')){
        alert("Proceed function is paused!")
        // const analyzeRequest = selectedRequest.url; 
        // const fetchRequest = analyzeRequest.split("#")[0];
        // const registerResponseFileURL = registerParticipationFolder + analyzeRequest.split("#")[1] + '.ttl';

        // fetchRequestURL(fetchRequest).then(fetchedRequestListRef=> {
        //   validateRequest(fetchedRequestListRef, analyzeRequest).then(validationOutcome=> {
        //     if (validationOutcome){
        //       // Need to test in the future 
        //       // const collectionSize = fetchedRequestListRef.getSubject(analyzeRequest).getInteger(schema.collectionSize);
        //       const requestModel = fetchedRequestListRef.getSubject(analyzeRequest).getString("http://schema.org/algorithm");

        //       // analyze data from regular request, 
        //       if (requestModel.includes("Regular")){
        //         const fetchedDoc = document.getElementById("fetchedDoc");
        //         fetchedDoc.setAttribute('style', 'white-space: pre;');
        //         let printString = '';
        //         let requestDataSum = 0;
        //         let requestDataList = [];

        //         const requestDataItem = fetchedRequestListRef.getSubject(analyzeRequest).getRef(schema.DataFeedItem);
                
        //         fetchRequestURL(registerResponseFileURL).then(fetchedRegisterResponseFile=> {
        //           // Find all participants response who participate the request
        //           const allResponsesSubjects = fetchedRegisterResponseFile.findSubjects()
        //           const uniqueResponsesSubjects = [];
        //           for (let i=0; i<allResponsesSubjects.length;i++){
        //             if (!uniqueResponsesSubjects.includes(allResponsesSubjects[i])){
        //               uniqueResponsesSubjects.push(allResponsesSubjects[i]);
        //             }
        //           }
                  
        //           console.log(uniqueResponsesSubjects)
        //           for (let i = 0; i < uniqueResponsesSubjects.length; i++){
        //             if (uniqueResponsesSubjects[i].getRef("http://schema.org/RsvpResponseYes") === analyzeRequest){

        //               const participantWebId = uniqueResponsesSubjects[i].getRef(schema.participant);  
        //               const participatePeriod = uniqueResponsesSubjects[i].getDateTime(schema.endDate);  
            
        //               if (participatePeriod > new Date(Date.now())){
        //                 console.log(new Date(Date.now()))
        //                 // fetch each participant's healthcondition.ttl
        //                 fetchRequestURL(participantWebId.split('profile')[0]+'private/healthrecord.ttl').then(fetchedParticipantData=> {
        //                   // get the latest age data
        //                   const fetchedParticipantTriple = fetchedParticipantData.getTriples();
        //                   for (let j = 0; j < fetchedParticipantTriple.length; j++){
        //                     if (fetchedParticipantTriple[j].predicate.id === requestDataItem){
        //                       printString += fetchedParticipantTriple[j].object.id + '\r\n'; //fetchedParticipantTriple[j].subject.id
        //                       requestDataSum += parseInt(fetchedParticipantTriple[j].object.value);
        //                       requestDataList.push(parseInt(fetchedParticipantTriple[j].object.value));
        //                       // Print the results at the end
        //                       if (i==uniqueResponsesSubjects.length-1 && j==fetchedParticipantTriple.length-1){
        //                         const finalResult = (requestDataSum/requestDataList.length);
        //                         fetchedDoc.textContent = "Results: \r\n" + printString + '\r\n Analysis result:' + finalResult.toString();
        //                         return finalResult
        //                       }
        //                     }
        //                   }
        //                 }).catch((err)=> {alert(err.message);});
        //               }else{alert("Participation period of "+ uniqueResponsesSubjects[i].toString + " has expired!")}
        //              }// }).catch((err)=> {alert(err.message);});
        //           }
        //         });
        //       }
        //       else if (requestModel.includes("Privacy")){
        //         alert("This request needs privacy-preserving analysis. This function has not been completed!");
        //       }
              
        //     }else{alert("Request validation is failed. Process is interrupted!")}
        //   });
        // });

      }


    /*
      // conduct analysis button
      else if (style.contains('rglLearning')) {
        const analyzeRequest = selectedRequest.url; 
        const fetchRequest = analyzeRequest.split("#")[0];

        fetchRequestURL(fetchRequest).then(fetchedRequestListRef=> {
          const validationOutcome = validateRequest(fetchedRequestListRef, analyzeRequest)
          if (validationOutcome){
            // Need to test in the future 
            const collectionSize = fetchedRequestListRef.getSubject(analyzeRequest).getInteger(schema.collectionSize);
            const requestModel = fetchedRequestListRef.getSubject(analyzeRequest).getString("http://schema.org/algorithm");

            // analyze data from regular request, 
            if (requestModel.includes("Regular")){
              const requestDataItem = fetchedRequestListRef.getSubject(analyzeRequest).getRef(schema.DataFeedItem);
              const getRequestTriples = fetchedRequestListRef.getTriples();
              
              // Find all participants response who participate the request
              let participantResponseId = [];
              for (let i = 0; i < getRequestTriples.length; i++){
                if (getRequestTriples[i].predicate.id === "http://schema.org/RsvpResponseYes" && getRequestTriples[i].object.id === analyzeRequest){
                  participantResponseId.push(getRequestTriples[i].subject.id);  
                }
              }

              const fetchedDoc = document.getElementById("fetchedDoc");
              fetchedDoc.setAttribute('style', 'white-space: pre;');

              let printString = '';
              let requestDataSum = 0;
              let requestDataList = [];

              for (let i = 0; i < participantResponseId.length; i++){
                // Fetch each response in the request.ttl
                fetchRequestURL(participantResponseId[i]).then(fetchedparticipantResponse=> {
                  // Find the healthcondition.ttl
                  const participantWebId = fetchedparticipantResponse.getSubject(participantResponseId[i]).getRef(schema.participant)
                  const participatePeriod = fetchedparticipantResponse.getSubject(participantResponseId[i]).getDateTime(schema.endDate)
                  if (participatePeriod > new Date(Date.now())){
                    // fetch each participant's healthcondition.ttl
                    fetchRequestURL(participantWebId.split('profile')[0]+'private/healthrecord.ttl').then(fetchedParticipantData=> {
                      // get the latest age data
                      const fetchedParticipantTriple = fetchedParticipantData.getTriples();
                      for (let j = 0; j < fetchedParticipantTriple.length; j++){
                        if (fetchedParticipantTriple[j].predicate.id === requestDataItem){
                          printString += fetchedParticipantTriple[j].object.id + '\r\n'; //fetchedParticipantTriple[j].subject.id
                          requestDataSum += parseInt(fetchedParticipantTriple[j].object.value);
                          requestDataList.push(parseInt(fetchedParticipantTriple[j].object.value))
                          // Print the results at the end
                          if (i==participantResponseId.length-1 && j==fetchedParticipantTriple.length-1){
                            fetchedDoc.textContent = "Results: \r\n" + printString + '\r\n Analysis result:' + (requestDataSum/requestDataList.length).toString();
                          }
                        }
                      }
                    }).catch((err)=> {alert(err.message);});
                  }else{alert("Participation period of "+ participantResponseId[i].toString + " has expired!")}
                }).catch((err)=> {alert(err.message);});
              }
            }
            else if (requestModel.includes("Privacy")){
              alert("Your request needs privacy-preserving analysis. Please click 'PRIVACY-PRESERVING ANALYSIS button!");
            }
          }else{alert("You cannot do analysis on the data because your request alidation is failed!")}
        }).catch((err)=> {alert(err.message);});
      }

      // analyze data from privacy-preserving data request
      else if (style.contains('ppLearning')) {
        const analyzeRequest = selectedRequest.url;
        const fetchRequest = analyzeRequest.split("#")[0];
        
        fetchRequestURL(fetchRequest).then(fetchedRequestListRef=> {
          // Need to test in the future 
          const collectionSize = fetchedRequestListRef.getSubject(analyzeRequest).getInteger(schema.collectionSize);
          const requestModel = fetchedRequestListRef.getSubject(analyzeRequest).getString("http://schema.org/algorithm");
          if (requestModel.includes("Privacy")){
            const requestDataItem = fetchedRequestListRef.getSubject(analyzeRequest).getRef(schema.DataFeedItem);
            const getRequestTriples = fetchedRequestListRef.getTriples();
            
            // Find all response to this request with requested data item
            let participantResponseId = [];
            for (let i = 0; i < getRequestTriples.length; i++){
              if (getRequestTriples[i].predicate.id === "http://schema.org/RsvpResponseYes" && getRequestTriples[i].object.id === analyzeRequest){
                participantResponseId.push(getRequestTriples[i].subject.id);  
              }
            }
  
            const fetchedDoc = document.getElementById("fetchedDoc");
            fetchedDoc.setAttribute('style', 'white-space: pre;');
            let printString = '';
            let requestDataSum = 0;
            let requestDataList = [];
  
            for (let i = 0; i < participantResponseId.length; i++){
              // Fetch each response in the request.ttl
              fetchRequestURL(participantResponseId[i]).then(fetchedparticipantResponse=> {
                // Find the healthcondition.ttl
                const requestedDataResult = fetchedparticipantResponse.getSubject(participantResponseId[i]).getInteger(requestDataItem)
                printString += requestedDataResult + '\r\n'; //fetchedParticipantTriple[j].subject.id
                requestDataSum += parseInt(requestedDataResult);
                requestDataList.push(parseInt(requestedDataResult))
  
                if (i==participantResponseId.length-1){
                  fetchedDoc.textContent = printString + '\n Analysis result:' + (requestDataSum/requestDataList.length).toString();
                }
              }).catch((err)=> {alert(err.message);});
            }
          }
          else if (requestModel.includes("Regular")){alert("Your request needs regular analysis. Please click 'REGULAR ANALYSIS button!");}
        }).catch((err)=> {alert(err.message);});
      }
      */

    });
  });

}

function saveRequestForValidation(fetchedRequestListRef, analyzeRequest){

  const subjectTriple = fetchedRequestListRef.getSubject(analyzeRequest);
  const subject = subjectTriple.asRef(); // `<${}> <${}> <${}>.\n`
  
  let requestTripleString = `<${subject}> <${rdf.type}> <${subjectTriple.getRef(rdf.type)}>.\n`;
  requestTripleString += `<${subject}> <http://schema.org/algorithm> "${subjectTriple.getString("http://schema.org/algorithm")}".\n`;
  requestTripleString += `<${subject}> <http://schema.org/collectionSize> ${subjectTriple.getInteger(schema.collectionSize)}.\n`;
  requestTripleString += `<${subject}> <${schema.creator}> <${subjectTriple.getRef(schema.creator)}>.\n`;
  requestTripleString += `<${subject}> <${schema.dateCreated}> "${subjectTriple.getDateTime(schema.dateCreated).toString().split(" (")[0]}".\n`;
  requestTripleString += `<${subject}> <${schema.endDate}> "${subjectTriple.getDateTime(schema.endDate).toString().split(" (")[0]}".\n`;
  requestTripleString += `<${subject}> <http://schema.org/purpose> "${subjectTriple.getString("http://schema.org/purpose")}".\n`;
  const dataElementList = subjectTriple.getAllRefs(schema.DataFeedItem);
  if (dataElementList) {
    for (let i=0; i<dataElementList.length; i++){
      requestTripleString += `<${subject}> <${schema.DataFeedItem}> <${dataElementList[i]}>.\n`;
    } 
  }
  return requestTripleString
}

async function validationProcess(fetchedRequestListRef, analyzeRequest, singleRequesterWebID){
  // const registerFileURL = "https://chang.inrupt.net/registerlist/requestlist.ttl";
  const fetchRegisterRecord = await fetchDocument(registerFileURL);
  const signature = fetchRegisterRecord.findSubject(schema.recordedAs, analyzeRequest).getString(schema.validIn);
  const requesterKeyDoc = await fetchDocument(userRegisterRef);
  const requesterKeyTriple = requesterKeyDoc.getTriples()
  for (let i=0;i<requesterKeyTriple.length;i++){
    if (requesterKeyTriple[i].subject.id.split(".ttl#")[1] == singleRequesterWebID){
      if (requesterKeyTriple[i].predicate.id == "http://schema.org/hasCredential"){
        const publicKey = requesterKeyTriple[i].object.value;
        if (signature){
          const requestContent = saveRequestForValidation(fetchedRequestListRef, analyzeRequest);
          const verficiationOutput = sign.detached.verify(decodeUTF8(requestContent), decodeBase64(signature), decodeBase64(publicKey))
          return verficiationOutput
        }else{alert("Lack of a valid signature! Execution interrupted!");}
      }else{alert("This requester does not have a credential. Execution interrupted!")}; 
    }
  } 
}

/****** PAUSE BLOCKCHAIN VALIDATION 
async function validateRequest(fetchedRequestListRef, analyzeRequest){
  // const registerFileURL = "https://chang.inrupt.net/registerlist/requestlist.ttl";
  const fetchRegisterRecord = await fetchDocument(registerFileURL);
  const contractID = fetchRegisterRecord.findSubject(schema.recordedAs, analyzeRequest).getString(schema.validIn);
  // console.log(fetchRegisterRecord.findSubject(schema.recordedAs, analyzeRequest).getTriples())

  if (contractID){
    //send to blockchain to validate the request
    let formdata = new FormData();

    const requestTripleString = "data:text/plain;base64," + btoa(saveRequestForValidation(fetchedRequestListRef, analyzeRequest));
    const fileTitle = analyzeRequest.split('#')[1];
    const token = document.getElementById("input_token").value;

    //Convert dataurl to file object
    const convertedFile = dataURLtoFile(requestTripleString, fileTitle+'.ttl'); 

    formdata.append("data", convertedFile, fileTitle);
    const requestOptions = {method: 'POST', body: formdata, redirect: 'follow'};

    const response = await fetch(`https://blockchain7.kmi.open.ac.uk/rdf/merkle/validate/set?token=${token}&contract=${contractID}`, requestOptions)
    if (response.ok){
      const result = await response.text();
      console.log(result);
      alert("Validation Passed!");
      return true;
    }else {alert("HTTP-Error: " + response.status); return false;}
  }else{alert("Your request is not in the validation blockchain"); return true;}
}
*************/

// Namespace Suggestions
searchIcons.forEach(function(each_search){
  each_search.addEventListener("click", function(e){
    e.preventDefault();
    const styles = e.currentTarget.classList;
    const tables = document.querySelectorAll(".table");

    if (styles.contains('predicateSuggestion')){
      var addTripleSearch = document.getElementById("addTriplePredicate").value;
    }else if (styles.contains('objectSuggestion')){
      var addTripleSearch = document.getElementById("addTripleObject").value;
    }

    // GET the URL from the text user put
    var resultObj = [];
    if (addTripleSearch){
      let namespaceList = [schema, foaf, rdf, skos, dc, dct]
      for (let i=0; i<namespaceList.length; i++){
        let nameSpace = namespaceList[i];
        resultObj = searchTermsNamespaces(resultObj, addTripleSearch, nameSpace);
      }
    }

    if (resultObj.length==0){
      resultObj.push({Text:addTripleSearch, FoundURI:"Sorry, we couldn't find matched identifiers(URI)."})
    }

    tables.forEach(function(table){
      if (table.classList.contains("searchTable")){
        printTable(table, resultObj, false);
      }
    });

  });
});

// Button Choice 
btns.forEach(function(btn) {
  btn.addEventListener("click", function(e){
    e.preventDefault();
    const styles = e.currentTarget.classList;
    // Get public-private key pairs for new registered users
    if (styles.contains('userRegisterbtn')){
      const userName = document.getElementById("userName").value;
      const affiliance = document.getElementById("affiliance").value;
      getWebId().then(webId => {
        const fetchProfile = webId
        generatePublicKeyPair(fetchProfile, userName, affiliance).then(response => {
          const tokenMessage = document.getElementById("tokenMessage");
          tokenMessage.setAttribute("style", "word-wrap: break-word");
          tokenMessage.textContent = response;
        });
      });
    }

    // Get blockchain user and passwords
    if (styles.contains('bcTokenLogin')){
      const bcTokenUser = document.getElementById("bcTokenUser").value;
      const bcTokenPassword = document.getElementById("bcTokenPassword").value;
      const tokenMessage = document.getElementById("tokenMessage");
      tokenMessage.setAttribute("style", "word-wrap: break-word");
      const requestOptions = {method: 'POST', redirect: 'follow'};

      fetch(`https://blockchain7.kmi.open.ac.uk/rdf/users/signin?username=${bcTokenUser}&password=${bcTokenPassword}`, requestOptions)
        .then(response => response.text())
        .then(result => {
          if (result.includes("token")){
            const bcToken = result.substring(result.lastIndexOf('{"token":"') + 10, result.lastIndexOf('"')); 
            tokenMessage.textContent = " Please save the token and it lasts for 5 hours. \n Your token is " + bcToken;
            console.log(result)
          }else{
            alert("Username or password is incorrect!")
          }
        })
        .catch(error => alert('error', error));
    }

    // Fetch data from the files all triples or objects
    else if (styles.contains('fetchObjects') || styles.contains('fetchTriples')) {

      if (styles.contains('fetchTriples')){
        var fetchFrom = document.getElementById("fetchFromTriples").value;
      }
      else{
        var fetchFrom = document.getElementById("fetchFromObjects").value;
      } 

      const fetchSubject = document.getElementById("fetchSubject").value;
      const fetchPredicate = document.getElementById("fetchPredicate").value;
      const getTriplesOption = styles.contains('fetchTriples');
      
      getTriplesObjects(fetchFrom, fetchSubject, fetchPredicate, getTriplesOption).then(getFetchedData => {
        const tables = document.querySelectorAll(".table");

        // print the triples as "subject" "predicate" "object"
        let tripleResults = [];
        if (styles.contains('fetchTriples')){
          for (let i = 0; i < getFetchedData.length; i++){
            tripleResults.push({Subject:getFetchedData[i].subject.id, Predicate:getFetchedData[i].predicate.id, Object:getFetchedData[i].object.id}) 
          }
          tables.forEach(function(table){
            if (table.classList.contains("triples")){
              printTable(table, tripleResults, false);
            }
          });
        }
        else if (styles.contains('fetchObjects') && fetchSubject){
          for (let i = 0; i < getFetchedData.length; i++){
            if (fetchPredicate){
              tripleResults.push({Object:getFetchedData[i]})
            }
            else{
              tripleResults.push({Predicate:getFetchedData[i].predicate.id, Object:getFetchedData[i].object.id}) 
            }
          }
          tables.forEach(function(table){
            if (table.classList.contains("objects")){
              printTable(table, tripleResults, false);
            }
          });
        }
      });
    }

    // check if the user has the data files already (button)
    else if (styles.contains('createModel')) {
      const fileLocation = document.getElementById("fileLocation").value;
      const profileHead = "https://" + fileLocation.substring(fileLocation.lastIndexOf("https://") + 8, fileLocation.lastIndexOf("/")) +"/";
      const fileName = document.getElementById("fileName").value;
      const tables = document.querySelectorAll(".table");

      getNotesList(profileHead, fileLocation, fileName).then(fetchedNotesListRef => {
        var getTriples = fetchedNotesListRef.getTriples();
        const fetchedDoc = document.getElementById("createMessage");
        const table = document.querySelector("table");

        let tripleResults = [];
        for (let i = 0; i < getTriples.length; i++){
          tripleResults.push({Subject:getTriples[i].subject.id, Predicate:getTriples[i].predicate.id, Object:getTriples[i].object.id}) 
        }
        if (tripleResults.length>0){
          fetchedDoc.textContent = "Your file already exists with some triples";
          tables.forEach(function(table){
            if (table.classList.contains("fetchedTable")){
              printTable(table, tripleResults, false);
            }
          });
          
        }
        else{
          fetchedDoc.textContent = "Your file exists but nothing is inside!"
        }
        alert("Your file already exists!");
    
      }).catch((err)=> {
        const fetchedDoc = document.getElementById("createMessage");
        fetchedDoc.textContent = err.message
      });
    }

    else if (styles.contains('addSingleTriple')) {
      let tripleResults = [];
      const tables = document.querySelectorAll(".table");
      const addTriplePredicate = document.getElementById("addTriplePredicate").value;
      const addTripleObject = document.getElementById("addTripleObject").value;

      tripleResults.push({Predicate:addTriplePredicate, Object:addTripleObject});
      tables.forEach(function(table){
        if (table.classList.contains("addedTable")){
          printTable(table, tripleResults, true);
        }
      });
    }

    // Add data/triples to the data file (this can be changed as user wants)
    else if (styles.contains('addData')) {
      const fileLocation = document.getElementById("fileLocation").value;
      const profileHead = "https://" + fileLocation.substring(fileLocation.lastIndexOf("https://") + 8, fileLocation.lastIndexOf("/")) +"/";
      const fileName = document.getElementById("fileName").value;
      
      var addedTableDict = []
      const addedTable = document.getElementById("addedTable");
      var rowLength = addedTable.rows.length; // gets rows of table
      for (let i = 1; i < rowLength; i++){ //loops through rows    
        var oCells = addedTable.rows.item(i).cells; //gets cells of current row  
        addedTableDict.push({Predicate:oCells.item(0).innerHTML, Object:oCells.item(1).innerHTML}) //oCells;
      }

      getNotesList(profileHead, fileLocation, fileName).then(fetchedNotesListRef => {
        addNote(profileHead, addedTableDict, fetchedNotesListRef).then(success => {
        const fetchedDoc = document.getElementById("addTableMessage");
        fetchedDoc.textContent = "Above triples are saved in " + fileName;
        alert("Your editing is successful!")
        }).catch((err)=> {
          const fetchedDoc = document.getElementById("addTableMessage");
          fetchedDoc.textContent = err.message
        });
      });
    }

    // Check if the data request exists already
    else if (styles.contains('checkExtRequest')) {

      getWebId().then(webId => {
        const fetchProfile = webId;
        getRequestList(fetchProfile).then(fetchedRequestListRef => {

          const firstRequestMessage = document.getElementById("firstRequestMessage");
          firstRequestMessage.textContent = "Your have 'public/request.ttl' in your Solid Pod already. Ready to submit a data request!"
        });
      });
    }

    else if (styles.contains('addRequestedData')) {
      const addRequestedDataMessage = document.getElementById("addRequestedDataMessage");
      const addRequestedDataList = addRequestedDataMessage.textContent.split('\r\n');
      addRequestedDataMessage.setAttribute('style', 'white-space: pre;');

      const request_data = document.getElementById("addTriplePredicate").value;
      
      if (!addRequestedDataList.includes(request_data) && request_data.length>0){
        addRequestedDataList.push(request_data);
        addRequestedDataMessage.textContent += request_data + '\r\n';
      }
      const request_data_list = addRequestedDataMessage.textContent.split('\r\n')
      request_data_list.pop()
    }

    // Submit a new data request 
    else if (styles.contains('submitRequest')) {
      getWebId().then(webId => {

        const fetchProfile = webId
        const request_purpose = document.getElementById("input_purpose").value;

        const addRequestedDataMessage = document.getElementById("addRequestedDataMessage");
        const request_data = addRequestedDataMessage.textContent.split('\r\n')
        request_data.pop()
        
        const request_period = new Date(document.getElementById("input_period").value);
        const request_numInstance = document.getElementById("input_numInstance").value;
        const request_obj = document.getElementById("input_model")
        const request_model = request_obj.options[request_obj.selectedIndex].text;
        const request_input_token = document.getElementById("input_token").value;
    
        const addRequestContent = {'purpose':request_purpose, 'data':request_data, 'period':request_period, 'numInstance':request_numInstance, 'model':request_model, 'token':request_input_token};
        getRequestList(fetchProfile).then(fetchedRequestListRef => {
          addRequest(fetchProfile, addRequestContent, fetchedRequestListRef).then(outcome => {
            alert(outcome);
          });
        });
      });
    }

    // query the existing request
    else if (styles.contains('queryRequest')) {
      const fetchRequest = document.getElementById("fetchRequest").value;

      // if the user give the webID (will query all request of this person made)
      if (fetchRequest.slice(-15).includes('profile/card')){
        getRequestList(fetchRequest).then(fetchedRequestListRef => {
          const findAllSubjects = fetchedRequestListRef.findSubjects(rdf.type, "http://schema.org/AskAction");
          const profileWebID = fetchRequest;

          fetchRequestURL(profileWebID).then(webIdDoc => {
            plotCardsOnPage(webIdDoc, profileWebID, findAllSubjects, "fromWebID", "participant").then(outcome => {
              respondToRequest(outcome[0], outcome[1]);
            });
          });
        }).catch((err)=> {alert(err.message);});
      }
      else{
        // if the user give the request URL, (it will only query that single request)
        getTriplesObjects(fetchRequest, null, null, true).then(getTriples => {
          // const singleSubject = [];
          // singleSubject.push(getTriples);
          const profileWebID = "https://" + fetchRequest.substring(fetchRequest.lastIndexOf("https://") + 8, fetchRequest.lastIndexOf("/public")) + "/profile/card#me";

          fetchRequestURL(profileWebID).then(webIdDoc => {
            plotCardsOnPage(webIdDoc, profileWebID, getTriples, fetchRequest, "participant").then(outcome => {
              respondToRequest(outcome[0], outcome[1])
            });

          });
        }).catch((err)=> {alert(err.message);});
      } 
    }
  });
});

