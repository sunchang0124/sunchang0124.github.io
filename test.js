const fetch = require("node-fetch");
const { None } = require("rdf-namespaces/dist/vcard");

async function dataElement_getRecommender(input){

	let response = await fetch("http://data.bioontology.org/recommender?input="+input+"&apikey=21646475-b5a0-4e92-8aba-d9fcfcfea388");
	let data = await response.json();
	let item = [];
	let asInputOntology = "";

	for (let i=0; i<data.length; i++){
	item.push({Text: data[i]['ontologies'][0]['acronym'], FoundURI: data[i]['ontologies'][0]['@id'], Score:data[i]['evaluationScore']});
	asInputOntology += data[i]['ontologies'][0]['acronym'];
	if (i != data.length-1){
		asInputOntology += ","; 
	}
	}
	return asInputOntology //item
}

async function dataElement_getAnnotator(asInputOntology, input){
//"&ontologies="+asInputOntology+
	let response = await fetch("https://data.bioontology.org/annotator?text="+input+"&longest_only=false&exclude_numbers=false&whole_word_only=true&exclude_synonyms=false&expand_class_hierarchy=true&class_hierarchy_max_level=999&mapping=all&apikey=21646475-b5a0-4e92-8aba-d9fcfcfea388");
  let data = await response.json();
	let asInputAnnotator = [];


	for (let i=0; i<data.length; i++){
	  asInputAnnotator.push({URI: data[i]['annotatedClass']['@id'], Ont:data[i]['annotatedClass']['links']["ontology"].split("/ontologies/")[1]});
  }
	return asInputAnnotator;
}


async function dataElement_getUsers(annotator, input){
//
		let response = await fetch("http://data.bioontology.org/search?q="+ input +"&ontology="+annotator['Ont']+"&subtree_root_id="+annotator['URI']+"&apikey=21646475-b5a0-4e92-8aba-d9fcfcfea388");
    let data = await response.json();
  
	return data;
}


// dataElement_getRecommender("diabetes and Mental Health").then(asInputOntology => {
// 	dataElement_getAnnotator(asInputOntology, "Medical Health, Physical Health, Mental Health, DNA Code, Disability, Health History, Blood Type, Prescription, Health Record, Drug Test Result").then(asInputAnnotator=>{
//     let item = [];
//     console.log(asInputAnnotator.length)
//     // asInputAnnotator.forEach(annotator=>{
//       for (let k=0;k<asInputAnnotator.length;k++){
//         dataElement_getUsers(asInputAnnotator[k], "glucose").then(data=>{
//           if (data['collection'].length>0){
//             item.push(data['collection']);
//             console.log(data['collection'])
//           }
//         }).catch(e=>{})
//       }
      
//     // })
// 	})
// })

//Get all annotators from personal data categories and save to a ttl file in github//