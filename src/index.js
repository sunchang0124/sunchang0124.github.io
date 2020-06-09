import auth from "solid-auth-client";
import { fetchDocument } from 'tripledoc';
import { foaf } from 'rdf-namespaces';

const btns = document.querySelectorAll(".btn");
// Log out if user has been login on this machine
// auth.logout();

async function getWebId() {

  const logStatus = document.getElementById("logStatus");
  const headings = document.getElementById("headings");
  const fetch = document.getElementById("fetch");
  /* 1. Check if we've already got the user's WebID and access to their Pod: */

  let session = await auth.currentSession();
  if (session) {
    // logStatus.textContent = "Log Out";
    headings.textContent = "Fetch Data from Solid (click 'Fetch' button)";
    fetch.textContent = "Fetch";
    return session.webId;
  }
  else{
    logStatus.textContent = "Log In";
    headings.textContent = "Login with Your Identity Provider: ";
    /* 2. User has not logged in; ask for their Identity Provider: */
    const identityProvider = await getIdentityProvider();
    /* 3. Initiate the login process - this will redirect the user to their Identity Provider: */
    auth.login(identityProvider);
  } 
}

function getIdentityProvider() {
  const loading = document.getElementById("loading");
  loading.style.display = "none";

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
  loading.style.display = "none";
  const webIdElement = document.getElementById("webId");
  webIdElement.textContent = "Your WebID is: "+ webId;
  const webIdDisplay = document.getElementById("webIdDisplay");
  webIdDisplay.style.display = "initial";
  const btnLogout = document.getElementById("btn-logout");
  btnLogout.textContent = "Log Out";
  if (webId){
    alert('Welcome, ' + webId);
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

// Get Data From SOLID Pod
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
      const getTriples = fetchFromDoc.getTriples(fetchFrom);
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


btns.forEach(function(btn) {
  btn.addEventListener("click", function(e){
    e.preventDefault();
    const fetchFrom = document.getElementById("fetchFrom").value;
    const fetchSubject = document.getElementById("fetchSubject").value;
    const fetchPredicate = document.getElementById("fetchPredicate").value;
    const getTriplesOption = e.currentTarget.classList.contains('fetchTriples')
    
    getTriplesObjects(fetchFrom, fetchSubject, fetchPredicate, getTriplesOption).then(getFetchedData => {
      const fetchedText = document.getElementById("fetchedText");
      fetchedText.setAttribute('style', 'white-space: pre;');
      
      let printString = '';
      if (getTriplesOption || !fetchPredicate){
        for (let i = 0; i < getFetchedData.length; i++){
          printString += getFetchedData[i].subject.id + '\r\t' + getFetchedData[i].predicate.id + '\r\t' + getFetchedData[i].object.id + '. \r\n' ;
        }
      }
      else if (!getTriplesOption && fetchSubject && fetchPredicate){
        for (let i = 0; i < getFetchedData.length; i++){
          printString += getFetchedData[i] + '\r\n' ;
        }
      }
      fetchedText.textContent = printString;
    });
  });
});