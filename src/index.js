import auth from "solid-auth-client";
import { fetchDocument, createDocument } from 'tripledoc';
import { solid, schema, space, rdf, foaf} from 'rdf-namespaces';

const btns = document.querySelectorAll(".btn");

// ****** Log In and Log Out *********//
async function getWebId() {

  const logStatus = document.getElementById("logStatus");
  const headings = document.getElementById("headings");
  const fetch = document.getElementById("fetch");
  const createData = document.getElementById("createData");
  /* 1. Check if we've already got the user's WebID and access to their Pod: */

  let session = await auth.currentSession();
  if (session) {
    if (headings){headings.textContent = "Fetch Data from Solid (click 'Fetch' button)";}
    if (fetch){fetch.textContent = "Fetch";}
    if (createData){createData.textContent = "Create";}
    return session.webId;
  }
  else{
    logStatus.textContent = "Log In";
    if (headings){headings.textContent = "Login with Your Identity Provider: ";}
    /* 2. User has not logged in; ask for their Identity Provider: */
    const identityProvider = await getIdentityProvider();
    /* 3. Initiate the login process - this will redirect the user to their Identity Provider: */
    auth.login(identityProvider);
  } 
}

function getIdentityProvider() {
  const loading = document.getElementById("loading");
  if (loading){loading.style.display = "none";}
  
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
  const loading = document.getElementById("loading");
  if (loading){loading.style.display = "none";}
  const webIdElement = document.getElementById("webId");
  if (webIdElement){webIdElement.textContent = "Your WebID is: "+ webId;}
  const webIdDisplay = document.getElementById("webIdDisplay");
  if (webIdDisplay){webIdDisplay.style.display = "initial";}
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout){btnLogout.textContent = "Log Out";}
  if (webId){
    // alert('Welcome, ' + webId);
    btns.forEach(function(btn) {
      btn.addEventListener("click", function(e){
        e.preventDefault();
        const styles = e.currentTarget.classList;
        if (styles.contains('logout')) {
          auth.logout().then(()=> alert('See you soon!'))
        }
      });
    });
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



// ****** Setting up a data model *********//

async function getNotesList(fetchProfile) {

  const webIdDoc = await fetchDocument(fetchProfile);
  const profile = webIdDoc.getSubject(fetchProfile);

  /* 1. Check if a Document tracking our notes already exists. */
  const privateTypeIndexRef = profile.getRef(solid.privateTypeIndex);
  const privateTypeIndex = await fetchDocument(privateTypeIndexRef); 
  const notesListEntry = privateTypeIndex.findSubject(solid.forClass, schema.dataFeedElement);//schema.TextDigitalDocument

  /* 2. If it doesn't exist, create it. */
  if (notesListEntry === null) {
    // We will define this function later:
    return initialiseNotesList(profile, privateTypeIndex).then(()=> alert("New file 'private/healthcondition.ttl'is created!"));
  }
  else{
    const createFetch = document.getElementById("btn-createFetch");
    createFetch.textContent = "Fetch Data";
  }

  /* 3. If it does exist, fetch that Document. */
  const notesListRef = notesListEntry.getRef(solid.instance);

  return await fetchDocument(notesListRef);
}


async function initialiseNotesList(profile, typeIndex) {
  // Get the root URL of the user's Pod:
  const storage = profile.getRef(space.storage);

  // Decide at what URL within the user's Pod the new Document should be stored:
  const notesListRef = storage + 'private/healthcondition.ttl';

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
async function addNote(fetchProfile, content, notesList) {

  // Initialise the new Subject:
  const newDataElement = notesList.addSubject();
  // Indicate that the Subject is a schema:dataFeedElement:
  newDataElement.addRef(rdf.type, schema.dataFeedElement);
  // Set the Subject's `schema:text` to the actual note contents:
  // Store the date the note was created (i.e. now):
  newDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));
  
  newDataElement.addRef(schema.creator, fetchProfile);
  if (content.age) {newDataElement.addInteger(foaf.age, parseInt(content.age));}
  if (content.height) {newDataElement.addDecimal(schema.height, parseFloat(content.height));}
  if (content.weight) {newDataElement.addDecimal(schema.weight, parseFloat(content.weight));}
  if (content.diabetes) {newDataElement.addRef('http://purl.bioontology.org/ontology/SNOMEDCT/73211009', 'http://purl.bioontology.org/ontology/SNOMEDCT/'+content.diabetes);}
  newDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));

  const success = await notesList.save([newDataElement]);

  return success;
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

  /* 2. If it doesn't exist, create it. */
  if (requestListEntryList.length > 0) {
    for (let i=0;i<requestListEntryList.length;i++){
      const requestListRef = requestListEntryList[i].getRef(solid.instance);
      if (requestListRef){
        if (requestListRef.toString()===fetchProfile.slice(0, fetchProfile.length-15)+'public/request.ttl'){
          return await fetchDocument(requestListRef);
        }
      }
    }
  }
  return initialiseRequestList(profile, publicTypeIndex).then(()=> alert("New file 'public/request.ttl'is created!"));
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
  return requestList;
}


// Add request to the file 
async function addRequest(fetchProfile, content, requestList) {

  // Initialise the new Subject:
  const newDataElement = requestList.addSubject();
  // Indicate that the Subject is a schema:dataFeedElement:
  newDataElement.addRef(rdf.type, "http://schema.org/AskAction");
  // Set the Subject's `schema:text` to the actual note contents:
  // Store the date the note was created (i.e. now):
  
  newDataElement.addRef(schema.creator, fetchProfile);
  if (content.purpose) {newDataElement.addString("http://schema.org/purpose", content.purpose);}
  if (content.data) {newDataElement.addRef(schema.DataFeedItem, content.data);}
  if (content.period) {newDataElement.addDateTime(schema.endDate, new Date(content.period));}
  if (content.numInstance) {newDataElement.addInteger("http://schema.org/collectionSize", parseInt(content.numInstance));}
  if (content.model) {newDataElement.addString("http://schema.org/algorithm", content.model);}
  newDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));

  const success = await requestList.save([newDataElement]);

  return success;
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
      alert("New file 'private/participation.ttl'is created!");
      return participateList;
    });
  }
  else{
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
// Add participate to the file 
async function addParticipation(fetchProfile, requestList, participateRequestId, participateList, collectionSize, endDate, privacyOption) {
  const responseSize = requestList.findSubjects(rdf.type, schema.JoinAction).length;
  const responseDate = new Date(Date.now());
  const responseUser = participateList.findSubjects(schema.participant, fetchProfile);
  let responseUserExisted = false;

  for (let i =0;i<responseUser.length;i++){
    if (responseUser[i] === participateRequestId){
      const responseUserExisted = true;
    }
  }

  if (responseSize <= collectionSize){
    if (responseDate <= endDate){ 
      if (!responseUserExisted){
        if (!privacyOption){
          // add participate record to participation.ttl
          const newParticipateDataElement = participateList.addSubject();
          newParticipateDataElement.addRef(rdf.type, schema.JoinAction);

          newParticipateDataElement.addRef(schema.participant, fetchProfile);
          newParticipateDataElement.addRef("http://schema.org/RsvpResponseYes", participateRequestId);
          newParticipateDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));
      
          const participateSuccess = await participateList.save([newParticipateDataElement]);

          
          // add participate record to request.ttl
          const newRequestDataElement = requestList.addSubject();
          newRequestDataElement.addRef(rdf.type, schema.JoinAction);
          
          newRequestDataElement.addRef(schema.participant, fetchProfile);
          newRequestDataElement.addRef("http://schema.org/RsvpResponseYes", participateRequestId);
          newRequestDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));
      
          const requestSuccess = await requestList.save([newRequestDataElement]);
        }
        
        else if (privacyOption[0]){
          // add participate record to request.ttl
          const newRequestDataElement = requestList.addSubject();
          newRequestDataElement.addRef(rdf.type, schema.JoinAction);
          
          newRequestDataElement.addInteger(privacyOption[1], privacyOption[2]);
          newRequestDataElement.addRef("http://schema.org/RsvpResponseYes", participateRequestId);
          newRequestDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));
      
          const requestSuccess = await requestList.save([newRequestDataElement]);

          // add participate record to participation.ttl
          const newParticipateDataElement = participateList.addSubject();
          newParticipateDataElement.addRef(rdf.type, schema.JoinAction);

          newParticipateDataElement.addRef(schema.participant, fetchProfile);
          newParticipateDataElement.addRef("http://schema.org/RsvpResponseYes", participateRequestId);
          newParticipateDataElement.addDateTime(schema.dateCreated, new Date(Date.now()));
      
          const participateSuccess = await participateList.save([newParticipateDataElement]);
        }

        return "Success!";
      }else{alert("You are in the participates list already.")}
    }else{alert("Sorry, request end date has expired.")}
  }else{alert("Sorry, request has enough participants.")}
}


// Button Choice 
btns.forEach(function(btn) {
  btn.addEventListener("click", function(e){
    e.preventDefault();
    const styles = e.currentTarget.classList;

    if (styles.contains('fetchObjects') || styles.contains('fetchTriples')) {
        const fetchFrom = document.getElementById("fetchFrom").value;
        const fetchSubject = document.getElementById("fetchSubject").value;
        const fetchPredicate = document.getElementById("fetchPredicate").value;
        const getTriplesOption = styles.contains('fetchTriples');
        
        getTriplesObjects(fetchFrom, fetchSubject, fetchPredicate, getTriplesOption).then(getFetchedData => {
          const fetchedText = document.getElementById("fetchedText");
          fetchedText.setAttribute('style', 'white-space: pre;');
          
          let printString = '';
          if (styles.contains('fetchTriples') || !fetchPredicate){
            for (let i = 0; i < getFetchedData.length; i++){
              printString += getFetchedData[i].subject.id + '\r\t' + getFetchedData[i].predicate.id + '\r\t' + getFetchedData[i].object.id + '. \r\n' ;
            }
          }
          else if (!styles.contains('fetchTriples') && fetchSubject && fetchPredicate){
            for (let i = 0; i < getFetchedData.length; i++){
              printString += getFetchedData[i] + '\r\n' ;
            }
          }
          fetchedText.textContent = printString;
        });
    }

    else if (styles.contains('createModel')) {
      const fetchProfile = document.getElementById("fetchProfile").value;
      getNotesList(fetchProfile).then(fetchedNotesListRef => {
        const getTriples = fetchedNotesListRef.getTriples();
        const fetchedDoc = document.getElementById("fetchedDoc");
        fetchedDoc.setAttribute('style', 'white-space: pre;');

        let printString = '';
        for (let i = 0; i < getTriples.length; i++){
          printString += getTriples[i].subject.id + '\r\t' + getTriples[i].predicate.id + '\r\t' + getTriples[i].object.id + '. \r\n' ;
        }
        if (printString){
          printString = "Your file already exists. It has triples as below: \r\n" + printString;
          fetchedDoc.textContent = printString;
        }
        else{
          fetchedDoc.textContent = "Your file exists but nothing is inside!"
        }
        alert("Your file 'private/healthcondition.ttl' already exists!");
      });
    }

    else if (styles.contains('addData')) {
      const fetchProfile = document.getElementById("fetchProfile").value;
      const age = document.getElementById("input_age").value;
      const height = document.getElementById("input_height").value;
      const weight = document.getElementById("input_weight").value;
      const diabetes = document.getElementById("input_diabetes").value;
      const addContent = {'age':age, 'height':height, 'weight':weight, 'diabetes':diabetes};

      getNotesList(fetchProfile).then(fetchedNotesListRef => {
        addNote(fetchProfile, addContent, fetchedNotesListRef).then(success => {
        const fetchedDoc = document.getElementById("fetchedDoc");
        fetchedDoc.textContent = "New input data is stored in private/healthcondition.ttl";
        alert("Your editing is successful!")
        });
      });
    }


    else if (styles.contains('checkExtRequest')) {
      const fetchProfile = document.getElementById("fetchProfile").value;
      getRequestList(fetchProfile).then(fetchedRequestListRef => {
        const getTriples = fetchedRequestListRef.getTriples();
        const fetchedDoc = document.getElementById("fetchedDoc");
        fetchedDoc.setAttribute('style', 'white-space: pre;');

        let printString = '';
        for (let i = 0; i < getTriples.length; i++){
          printString += getTriples[i].subject.id + '\r\t' + getTriples[i].predicate.id + '\r\t' + getTriples[i].object.id + '. \r\n' ;
        }
        fetchedDoc.textContent = printString;
      });
    }

    else if (styles.contains('submitRequest')) {
      const fetchProfile = document.getElementById("fetchProfile").value;
      const request_purpose = document.getElementById("input_purpose").value;
      const request_data = document.getElementById("input_data").value;
      const request_period = document.getElementById("input_period").value;
      const request_numInstance = document.getElementById("input_numInstance").value;
      const request_obj = document.getElementById("input_model")
      const request_model = request_obj.options[request_obj.selectedIndex].text;
  
      const addRequestContent = {'purpose':request_purpose, 'data':request_data, 'period':request_period, 'numInstance':request_numInstance, 'model':request_model};
      getRequestList(fetchProfile).then(fetchedRequestListRef => {
        addRequest(fetchProfile, addRequestContent, fetchedRequestListRef).then(success => {
        const fetchedDoc = document.getElementById("fetchedDoc");
        fetchedDoc.textContent = "New request data is stored in public/request.ttl. Please give everyone poster access to your request.ttl.";
        alert("Your request editting is successful!")
        });
      });
    }

    else if (styles.contains('queryRequest')) {
      const fetchRequest = document.getElementById("fetchRequest").value;
      const fetchedDoc = document.getElementById("fetchedDoc");
      fetchedDoc.setAttribute('style', 'white-space: pre;');
      let printString = '';

      if (fetchRequest.slice(-15).includes('profile/card')){
        getRequestList(fetchRequest).then(fetchedRequestListRef=> {
          const getTriples = fetchedRequestListRef.getTriples();
          for (let i = 0; i < getTriples.length; i++){
            printString += getTriples[i].subject.id + '\r\t' + getTriples[i].predicate.id + '\r\t' + getTriples[i].object.id + '. \r\n' ;
          }
          fetchedDoc.textContent = printString;
        });
      }
      else{
        getTriplesObjects(fetchRequest, null, null, true).then(getTriples => {
          for (let i = 0; i < getTriples.length; i++){
            if (getTriples[i].subject.id === fetchRequest){
              printString += getTriples[i].subject.id + '\r\t' + getTriples[i].predicate.id + '\r\t' + getTriples[i].object.id + '. \r\n' ;
            }
          }
          fetchedDoc.textContent = printString;
        });
      }
    }


    else if (styles.contains('participate')) {
      const fetchParticipateRequestId = document.getElementById("participateRequest").value;
      
      getWebId().then(webId => {
        fetchRequestURL(fetchParticipateRequestId).then(fetchedRequestListRef=> {
          const collectionSize = fetchedRequestListRef.getSubject(fetchParticipateRequestId).getInteger(schema.collectionSize);
          const endDate = fetchedRequestListRef.getSubject(fetchParticipateRequestId).getDateTime(schema.endDate);
          const requestModel = fetchedRequestListRef.getSubject(fetchParticipateRequestId).getString("http://schema.org/algorithm");

          getParticipateList(webId).then(fetchedParticipateListRef=> {
            if (requestModel.includes('Regular')){
              addParticipation(webId, fetchedRequestListRef, fetchParticipateRequestId, fetchedParticipateListRef, collectionSize, endDate, requestModel.includes('Privacy')).then(success=> {
                alert(success);
                const fetchedDoc = document.getElementById("fetchedDoc");
                fetchedDoc.textContent = "Your participation is recorded. \n Please give requester (viewer) access to your data file.";
              });
            }
            else if (requestModel.includes('Privacy')){
              // Query the requested data item
              fetchRequestURL(fetchParticipateRequestId).then(fetchedParticipateRequest=>{
                const requestDataItem = fetchedParticipateRequest.getSubject(fetchParticipateRequestId).getRef(schema.DataFeedItem);
                fetchRequestURL(webId.split('profile')[0]+'private/healthcondition.ttl').then(fetchedParticipantData=> {
                  // get the latest age data
                  const fetchedParticipantTriple = fetchedParticipantData.getTriples();
      
                  for (let j = 0; j < fetchedParticipantTriple.length; j++){
                    if (fetchedParticipantTriple[j].predicate.id === requestDataItem){
                      const requestedDataResult = parseInt(fetchedParticipantTriple[j].object.value);

                      addParticipation(webId, fetchedRequestListRef, fetchParticipateRequestId, fetchedParticipateListRef, collectionSize, endDate, [true, requestDataItem, requestedDataResult]).then(success=> {
                        alert(success);
                        const fetchedDoc = document.getElementById("fetchedDoc");
                        fetchedDoc.textContent = "Your participation is in privacy-preserving analysis. Nothing has been recorded except the requested data.";
                      });
                    }
                  }
                }).catch(()=> {alert(err.message);});
              }).catch(()=> {alert(err.message);});
            } 
          });
        });
      });
    }

    else if (styles.contains('rglLearning')) {
      const analyzeRequest = document.getElementById("fetchRequest").value;
      const fetchRequest = analyzeRequest.split("#")[0];
      
      fetchRequestURL(fetchRequest).then(fetchedRequestListRef=> {
        // Need to test in the future 
        const collectionSize = fetchedRequestListRef.getSubject(analyzeRequest).getInteger(schema.collectionSize);
        const requestModel = fetchedRequestListRef.getSubject(analyzeRequest).getString("http://schema.org/algorithm");
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
              // fetch each participant's healthcondition.ttl
              fetchRequestURL(participantWebId.split('profile')[0]+'private/healthcondition.ttl').then(fetchedParticipantData=> {
                // get the latest age data
                const fetchedParticipantTriple = fetchedParticipantData.getTriples();

                for (let j = 0; j < fetchedParticipantTriple.length; j++){
                  if (fetchedParticipantTriple[j].predicate.id === requestDataItem){
                    printString += fetchedParticipantTriple[j].object.id + '\r\n'; //fetchedParticipantTriple[j].subject.id
                    requestDataSum += parseInt(fetchedParticipantTriple[j].object.value);
                    requestDataList.push(parseInt(fetchedParticipantTriple[j].object.value))
                    // Print the results at the end
                    if (i==participantResponseId.length-1 && j==fetchedParticipantTriple.length-1){
                      fetchedDoc.textContent = printString + '\n Analysis result:' + (requestDataSum/requestDataList.length).toString();
                    }
                  }
                }
              }).catch(()=> {alert(err.message);});
            }).catch(()=> {alert(err.message);});
          }
        }
        else if (requestModel.includes("Privacy")){
          alert("Your request needs privacy-preserving analysis. Please click 'PRIVACY-PRESERVING ANALYSIS button!");
        }
      }).catch(()=> {alert(err.message);});
    }


    else if (styles.contains('ppLearning')) {
      const analyzeRequest = document.getElementById("fetchRequest").value;
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
            }).catch(()=> {alert(err.message);});
          }
        }
        else if (requestModel.includes("Regular")){alert("Your request needs regular analysis. Please click 'REGULAR ANALYSIS button!");}
      }).catch(()=> {alert(err.message);});
    }
  });
});

