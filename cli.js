#!/usr/bin/env node

var applescript = require("applescript");
var fs          = require('fs');
var osenv       = require('osenv');
var temp        = require('temp').track();
var yaml        = require('js-yaml');
var GithubApi   = require("github");
var extend      = require('util')._extend;

var github,
    options = {
      version: "3.0.0"
    };

if (config = getConfig()) {
  if (config.githubOptions) {
    extend(options, config.githubOptions);
  }

  github = new GithubApi(options);
  github.authenticate({type: 'oauth', token: config.token});
  github.issues.getAll({filter: "assigned"}, processIssues);
}

function processIssues(err, res) {
  if (err) {
    handleHttpErrors(err);
    return;
  }

  var script = formatScript(res);

  temp.open('omnifocus-github', function(err, info) {
    if (!err) {
      fs.write(info.fd, script);
      fs.close(info.fd, function(err) {
        // @TODO: Remove empty callback when https://github.com/TooTallNate/node-applescript/issues/8 is resolved
        applescript.execFile(info.path, ["-lJavaScript"], function(err, rtn) {
          if(err){
              console.error(err);
          }
          console.log('--- complete');
        });
      });
    }
  });
}

function formatScript(arr) {
  var script = "";

  console.log(arr.length + ' issues founded');

  for (var i = 0, len=arr.length; i < len; ++i) {
    var parseText = arr[i].title + ' ::' + arr[i].repository.name + ' @github' + ' //' + arr[i].html_url;

    script += "of = Library('OmniFocus');";
    script += "var name = '"+ arr[i].title + "';";
    script += "if (of.tasksWithName(name).length <= 0) {";
    script += "of.parse('" + parseText + "');";
    script += "}\n";

    console.log(parseText);
  }

  return script;
}

function getConfig() {
  var path = osenv.home() + '/.omnifocus-github';

  try {
    return yaml.safeLoad(fs.readFileSync(path, 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT' && err.path === path) {
      console.log('Sorry, you must create a ' + path + ' configuration file.');
    }
    else {
      throw err;
    }
  }
}

function handleHttpErrors(err) {
  switch (err.code) {
    case 401:
      console.log('Could not authenticate. Check your oauth token in your configuration file.');
      break;
    default:
      throw err;
  }
}
