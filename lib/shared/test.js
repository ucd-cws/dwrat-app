// run test script

module.exports = function(file) {
  file.process.setFilename('SacRiver.csv');
  $.get('/testdata/SacRiver.csv', function(resp){
    file.process.importContents('text', resp);
  });
};
