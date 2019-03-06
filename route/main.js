module.exports = function(app, fs) {
  app.get('/', function(req, res) {
    res.render('index', {});
  });

  app.get('/report', function(req, res) {
    res.render('report', {});
  });

  //contract init
  app.get('/init/contract', function(req, res) {
    fs.readFile('./build/contracts/UsedProductShop.json', function handleFile(err, data) {
      res.end(data);
    });
  });

  app.post('/regist/product', function(req, res) {
    var offchain = req.body;
    fs.readFile('./db/db.json', function handleFile(err, data) {
      var productList = JSON.parse(data);
      var newProduct = {
        "id" : offchain.id,
        "title" : offchain.title,
        "description" : offchain.description,
        "imgURL" : offchain.imgURL
      };

      productList.push(newProduct);

      fs.writeFile('./db/db.json', JSON.stringify(productList), function handleFile(err,data){
        res.end("Insert");
      });
    });
  });

  app.get('/product/data/:id', function(req,res){
    var returnObj;
    var onchainId = req.params.id;

    var data = req.body;
    fs.readFile('./db/db.json', function handleFile(err, data) {
      var productList = JSON.parse(data);

      var productData_offChain;
      for (var i = 0; i < productList.length; i++) {
        if (onchainId == productList[i].id) {
          productData_offChain = productList[i];
          break;
        }
      }
      returnObj = productData_offChain;

      res.end(JSON.stringify(returnObj));
    });
  });

  app.get('/product/delete/:id', function(req,res){

    var onchainId = req.params.id;
    fs.readFile('./db/db.json', function handleFile(err, data) {
      var productList = JSON.parse(data);
      var newProductList = [];
      var productData_offChain;
      for (var i = 0; i < productList.length; i++) {
        if (onchainId != productList[i].id) {
          newProductList.push(productList[i]);
        }
      }

      fs.writeFile('./db/db.json', JSON.stringify(newProductList), function handleFile(err,data){
        res.end("Delete");
      });
    });
  });
}
