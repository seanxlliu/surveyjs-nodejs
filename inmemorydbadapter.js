var demoData = require("./demo-surveys");

function InMemoryDBAdapter(session) {
  function getTable(tableName) {
    var table = session[tableName];
    if (!table) {
      table = [];
      session[tableName] = table;
    }
    return table;
  }

  function getObjectsFromStorage(tableName, callback) {
    var objects = {};
    var table = getTable(tableName);
    table.forEach(function(item) {
      objects[item.name] = item;
    });
    callback(objects);
  }

  function addSurvey(name, callback) {
    var table = getTable("surveys");
    var newObj = {
      name: name,
      json: "{}"
    };
    table.push(newObj);
    callback(newObj);
  }

  function postResults(postId, json, callback) {
    var table = getTable("results");
    var newObj = {
      postid: postId,
      json: json
    };
    table.push(newObj);
    callback(newObj);
  }

  function getResults(postId, callback) {
    var table = getTable("results");
    var results = table
      .filter(function(item) {
        return item.postid === postId;
      })
      .map(function(item) {
        return item.json;
      });
    callback(results);
  }

  function deleteSurvey(surveyId, callback) {
    var table = getTable("surveys");
    var result = table.filter(function(item) {
      return item.name === surveyId;
    })[0];
    table.splice(table.indexOf(result), 1);
    callback(result);
  }

  function storeSurvey(id, json, callback) {
    var table = getTable("surveys");
    var result = table.filter(function(item) {
      return item.name === id;
    })[0];
    if (!!result) {
      result.json = json;
    } else {
      result = {
        name: id,
        json: json
      };
      table.push(result);
    }
    callback && callback(result);
  }

  function changeName(id, name, callback) {
    var table = getTable("surveys");
    var result = table.filter(function(item) {
      return item.name === id;
    })[0];
    if (!!result) {
      result.name = name;
    }
    callback && callback(result);
  }

  function getSurveys(callback) {
    getObjectsFromStorage("surveys", function(objects) {
      if (Object.keys(objects).length > 0) {
        callback(objects);
      } else {
        var table = getTable("results");
        Object.keys(demoData.surveys).forEach(function(surveyId) {
          storeSurvey(surveyId, JSON.stringify(demoData.surveys[surveyId]));
          table.push.apply(
            table,
            demoData.results[surveyId].map(function(item) {
              return {
                postid: surveyId,
                json: item
              };
            })
          );
        });
        getObjectsFromStorage("surveys", callback);
      }
    });
  }

  function getSurvey(surveyId, callback) {
    getSurveys(function(result) {
      callback(JSON.parse(result[surveyId].json));
    });
  }

  function elementToColumn(element) {
    const otherTypes = ['checkbox', 'multipletext'];
    const kvTypes = ['dropdown', 'radiogroup'];
    const strTypes = ['comment', 'text'];
    const intTypes = ['rating', 'boolean'];

    if (otherTypes.includes(element.type)) {
      return element;
    } else if (kvTypes.includes(element.type)) {
      return { type: 'kv', name: element.name, choices: element.choices };
    } else if (strTypes.includes(element.type)) {
      return { type: 'str', name: element.name };
    } else if (intTypes.includes(element.type)) {
      return { type: 'int', name: element.name };
    } else {
      console.log('Element type is not handled', element)
      return { type: 'str', name: element.name, orgtype: element.type };
    }
  }

  function resultToRow(result, columns) {
    let row = {};
    const converts = {
      checkbox: (column, answer) => column.choices.forEach( c => row[`${column.name}_${c.text || c}`] = answer && answer.includes(c.value || c) ? 1 : 0 ),
      multipletext: (column, answer) => column.items.forEach( i => row[`${column.name}_${i.name}`] = answer ? answer[i.name] : ''),
      kv: (column, answer) => column.choices.forEach( c => row[`${column.name}_${c.text || c}`] = answer && answer == (c.value || c) ? 1 : 0),
      int: (column, answer) => row[column.name] = answer ? Number(answer) : 0,
      str: (column, answer) => row[column.name] = answer || ''
    }

    for (const name in columns) {
      if (columns.hasOwnProperty(name)) {
        const column = columns[name];
        converts[column.type](column, result[name]);
      }
    }
    return row;
  }

  function analyzeResults(surveyId, callback) {
    getSurvey(surveyId, survey => {
      getResults(surveyId, results => {
        try {
          let columns = {};
          if (survey && survey.pages && Array.isArray(survey.pages)) {
            columns = survey.pages.reduce((cs, page) => {
              if (page.elements && page.elements.length > 0) {
                page.elements.forEach(e => { cs[e.name] = elementToColumn(e); })
              }
              return cs;
            }, {});
          }
          console.log('create table from', columns);

          let rows = results.map(r => resultToRow(JSON.parse(r), columns));
          console.log('create data from', rows);
        } catch(e) {
          console.log('Failed to build results.', e);
          console.log(survey);
          console.log(results);
        }
        callback();
      })
    })
  }

  return {
    addSurvey: addSurvey,
    getSurvey: getSurvey,
    storeSurvey: storeSurvey,
    getSurveys: getSurveys,
    deleteSurvey: deleteSurvey,
    postResults: postResults,
    getResults: getResults,
    changeName: changeName,
    analyzeResults: analyzeResults
  };
}

module.exports = InMemoryDBAdapter;
