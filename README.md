# Hello, SOLID

Date: 17-04-2020

Editor: Chang Sun



### What is SOLID? 

SOLID stands for Social Linked Data. Briefly, SOLID allows you to 

- own your data and choose apps to manage your own data
- store data in your personal storage space (pod)
- have your identity instead of using a third party account

Learn detailed explanations about SOLID [here](https://solid.inrupt.com/how-it-works)

### Getting start 

There are many tutorals teaching people how to start with SOLID. Considerting people might be in different programming levels, I recommend you follow the most suitable tutorial based on your background and needs.

- If you don't have any programming experience but want to know and learn to use SOLID. This [tutorial](https://github.com/comunica/Tutorial-Solid-Getting-Started/wiki/Tutorial-walkthrough) might be the best option for you. 
- If you have programming background but have no clue about Semantic Web/Linked Data/Resource Description Framework (RDF), I suggest you first go through this [Introduction to Linked Data](https://solid.inrupt.com/docs/intro-to-linked-data). Then,  Solid Specification [1. Draft version](https://github.com/solid/solid-spec) [2. Latest version](https://solid.github.io/specification/) is the document you have to read if you want to build up a SOLID app by yourself. 



### Build SOLID Application 

Since I don't have Javascript and npm work experience, I had to learn some knowledge about them first. I followed two tutorial videos:
1. [Javascript for beginner](https://www.youtube.com/watch?v=PkZNo7MFNFg)
2. [Javascript project tutorial](https://www.youtube.com/watch?v=c5SIG7Ie0dM&t=4730s)

Then, I would suggest you learn how to use npm and webpack:

1. npm [Get started](https://docs.npmjs.com/getting-started/) [Tutorial](https://github.com/workshopper/how-to-npm) [Crash course](https://www.youtube.com/watch?v=jHDhaSSKmB0) [Installation](https://www.npmjs.com/get-npm)
2. webpack [Get started](https://webpack.js.org/guides/getting-started/) [Installation](https://webpack.js.org/guides/installation/)

If you have experience with Javascript, npm, and webpack, you can follow this official tutorial from SOLID [Write a SOLID application](https://solidproject.org/for-developers/apps/first-app). 



How I build the first SOLID App:

1. Make sure you have installed recent updated npm. `npm -v`
2. Start with ***../dist/index.html*** and ***../src/index.js*** (you should learn this from the Javascript tutorials)
3. Create a new folder. In this folder, run `npm init` and follow the instruction. You will get a *node_modules* folder and *package.json* file. Next, run the following command. Then you will see the updates in the *package.json* file.

``` shell
npm install --save @type/solid-auth-client
npm install --save solid-auth-client
npm install --save-dev webpack
npm install --save-dev webpack-cli
```

4. Following the [guidence](https://webpack.js.org/guides/getting-started/), in ***package.json*** do:

   ```diff
   ...
   + "private": true,
   - "main": "index.js",
   ...
   ```

   in dist/index.html, do:

   ```diff
      <body>
   -    <script src="./src/index.js"></script>
   +    <script src="main.js"></script>
      </body>
   ```

   Next, in the folder, run `npx webpack` , then you will see a ***tsconfig.josn*** appears.

