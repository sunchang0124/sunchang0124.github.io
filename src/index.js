import auth from "solid-auth-client";
import { fetchDocument } from 'tripledoc';
import { foaf } from 'rdf-namespaces';

const btns = document.querySelectorAll(".btn");

async function getWebId() {
  /* 1. Check if we've already got the user's WebID and access to their Pod: */
  let session = await auth.currentSession();
  if (session) {
    return session.webId;
  }
  /* 2. User has not logged in; ask for their Identity Provider: */
  const identityProvider = await getIdentityProvider();

  /* 3. Initiate the login process - this will redirect the user to their Identity Provider: */
  auth.login(identityProvider);
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
  // webIdDisplay.style.display = "initial";
  if (webId){
    alert('Welcome!');
  }

  btns.forEach(function(btn) {
    btn.addEventListener("click", function(e){
      e.preventDefault();
      if (e.currentTarget.classList.contains('logout')) {
        console.log("Log out!");
        auth.logout().then(() => alert('Goodbye!'));
      };
    });
  });
});

async function getName(webId) {
  /* 1. Fetch the Document at `webId`: */
  const webIdDoc = await fetchDocument("https://chang.inrupt.net/public/apptest.ttl");
  /* 2. Read the Subject representing the current user's profile: */
  const profile = webIdDoc.getSubject("https://chang.inrupt.net/profile/card#me");
  // const profile = webIdDoc.getSubject("https://chang.inrupt.net/public/apptest.ttl"); 
  /* 3. Get their foaf:name: */

  // console.log(webIdDoc_te.getTriples("https://chang.inrupt.net/profile/card#me")); 
  console.log(profile.getAllRefs()); 
  console.log(profile.getAllLiterals()); 
  console.log(profile.getInteger("http://schema.org/height"));
  console.log(profile.getString("http://xmlns.com/foaf/0.1/name"));
  // console.log(profile.getInteger(foaf.age))
  return "abc"
}

getName(webId).then(profileString => {
  btns.forEach(function(btn) {
    btn.addEventListener("click", function(e){
      e.preventDefault();
      if (e.currentTarget.classList.contains('fetch')) {
        console.log(profileString);
      };
    });
  });
});