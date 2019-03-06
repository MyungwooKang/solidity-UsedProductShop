pragma solidity 0.4.24;

contract UsedProductShop {
    address owner = msg.sender;

    uint FEE_REGISTRATION = 1 ether; //fee. for registration
    uint FEE_RESERVATION = 1 ether; //fee. for reservation
    uint MIN_PRICE_PRODUCT = 2 ether;

    uint balance = 0; //Amount of money kept for safety transactions.
    uint fee = 0; //Amount of fee(tax)

    struct ProductInfo { //registed product info (on-chain)
        uint id;
        uint price;
        address buyerAccount;
        address sellerAccount;
        string sellerPhoneNumber;
        uint state; //0:registration, 1:reservation, 2:delivering, 3:receipt, 4>= problem
        uint lastStateChangedDate;
    }

    struct DeliveryInfo { //For delivery
        string buyerHomeAddress;
        string buyerPhoneNumber;
        string trackingNumber;

    }

    struct DeclarationInfo{ //Mediation request
      address registerAccount;
    }

    mapping(uint => DeliveryInfo) deliveryInfo;
    mapping(uint => ProductInfo) productInfo;
    mapping(uint => DeclarationInfo) declarationInfo;

    uint idGenerator = 0;

    /*
    * [destructor]
    * Owner can distroy this contract
    */
    function destroyContract() onlyOwner() public {
        selfdestruct(owner);
    }


    /*
    * [view]
    * ownerAddress
    * #params :
    * #return :
    *
    * Return owner address
    *
    */
    function ownerAddress() public view returns(address) {
        return owner;
    }
    /*
    * [view]
    * viewProductLastId
    * #params :
    * #return : idGenerator
    *
    * Get the last id. It is used for list inquiry.
    */
    function viewProductLastId() public view returns (uint) {
      return idGenerator;
    }

    /*
    * [view]
    * viewProductInfo
    * #params : _index
    * #return : ProductInfo (id, price, sellerAccount, buyerAccount, sellerPhoneNumber, state, lastStateChangedDate)
    *
    * Returns the ProductInfo corresponding to the index.
    */
    function viewProductInfo(uint _index) existProduct(_index) public view returns (uint, uint, address, address, string, uint, uint) {
        ProductInfo memory product = productInfo[_index];

        return (product.id, product.price, product.sellerAccount, product.buyerAccount, product.sellerPhoneNumber, product.state, product.lastStateChangedDate);
    }

    /*
    * [view]
    * viewDeliveryInfo
    * #params : _index
    * #return : DeliveryInfo (buyerHomeAddress, buyerPhoneNumber, trackingNumber)
    *
    * Returns the DeliveryInfo corresponding to the index.
    */
    function viewDeliveryInfo(uint _index) existProduct(_index) onlyBuyerOrSeller(_index) public view returns (string, string, string) {
        require(productInfo[_index].state >= 1 || productInfo[_index].state <= 4 , "Invalid product state");

        DeliveryInfo memory delivery = deliveryInfo[_index];

        return (delivery.buyerHomeAddress, delivery.buyerPhoneNumber, delivery.trackingNumber);
    }

    /*
    * [view]
    * viewDeclarationInfo
    * #params : _index
    * #return : DeclarationInfo  (registerAccount, sellerPhoneNumber, buyerPhoneNumber, trackingNumber)
    *
    * Returns the DeclarationInf(mediation request) corresponding to the index.
    *
    */
    function viewDeclarationInfo(uint _index) existDeclaration(_index) onlyStakeHolder(_index) public view returns(address,string,string,string){
      return (declarationInfo[_index].registerAccount, productInfo[_index].sellerPhoneNumber, deliveryInfo[_index].buyerPhoneNumber, deliveryInfo[_index].trackingNumber);
    }


    /*
    * [add]
    * registProduct
    * #params : _index, _sellerPhoneNumber
    * #return : ProductInfo  (id, price, sellerAccount, buyerAccount, sellerPhoneNumber, state, lastStateChangedDate)
    *
    * Registers the product, sets the default value, and returns.
    *
    */
    function registProduct(uint _price, string _sellerPhoneNumber) public payable returns (uint, uint,address,address,string,uint, uint) {
        require(FEE_REGISTRATION == msg.value, "Invalid 'eth value'");
        require((_price * 1 ether) >= MIN_PRICE_PRODUCT, "Invalid 'price'");

        idGenerator++;

        ProductInfo memory product;
        product.id = idGenerator;
        product.price = _price;
        product.sellerAccount = msg.sender;
        product.buyerAccount = address(0);
        product.sellerPhoneNumber = _sellerPhoneNumber;
        product.state = 0;
        product.lastStateChangedDate = now;

        productInfo[idGenerator] = product;

        balance += (msg.value - FEE_REGISTRATION);
        fee += FEE_REGISTRATION;

        return (product.id, product.price, product.sellerAccount, product.buyerAccount, product.sellerPhoneNumber, product.state, product.lastStateChangedDate);
    }

    /*
    * [set]
    * reserveProduct
    * #params : _index, _homeAddress, _phone
    * #return :
    *
    * Make a purchase reservation for the item.
    * Purchase reservation state, and sets buyer-eth-wallet information and destination-related information.
    *
    */
    function reserveProduct(uint _index, string _homeAddress, string _phone) existProduct(_index) public payable {
        require(FEE_RESERVATION + (productInfo[_index].price * 1 ether) == msg.value, "Invalid 'eth value'");
        require(productInfo[_index].state == 0, "Invalid product state");

        deliveryInfo[_index].buyerHomeAddress = _homeAddress;
        deliveryInfo[_index].buyerPhoneNumber = _phone;

        productInfo[_index].buyerAccount = msg.sender;
        productInfo[_index].state = 1;
        productInfo[_index].lastStateChangedDate = now;

        balance += (msg.value - FEE_RESERVATION);
        fee += FEE_RESERVATION;
    }

    /*
    * [set]
    * cancelReservationByBuyer
    * #params : _index
    * #return :
    *
    * Cancel the purchase reservation. Except for the commission, only the commodity price is refunded.
    *
    */
    function cancelReservationByBuyer(uint _index) existProduct(_index) onlyBuyer(_index) public {
        require(productInfo[_index].state == 1, "Invalid product state");

        productInfo[_index].state = 0;
        productInfo[_index].lastStateChangedDate = now;
        productInfo[_index].buyerAccount = address(0);

        delete deliveryInfo[_index];

        transferToAddress(msg.sender, productInfo[_index].price * 1 ether);
    }


    /*
    * [set]
    * deliverProduct
    * #params : _index, _trackingNumber
    * #return :
    *
    * Enter shipping information and change product status.
    *
    */
    function deliverProduct(uint _index, string _trackingNumber) existProduct(_index) onlySeller(_index) public {
        require(productInfo[_index].state == 1, "Invalid product state");

        productInfo[_index].state = 2;
        deliveryInfo[_index].trackingNumber = _trackingNumber;
        productInfo[_index].lastStateChangedDate = now;
    }

    /*
    * [set]
    * receiveProductAndPayment
    * #params : _index
    * #return :
    *
    * When the buyer confirms the purchase of the product, the system pays the product price to the seller.
    *
    */
    function receiveProductAndPayment(uint _index) existProduct(_index) onlyBuyer(_index) public {
        require(productInfo[_index].state == 2, "Invalid product state");

        productInfo[_index].state = 3;
        productInfo[_index].lastStateChangedDate = now;
        transferToAddress(productInfo[_index].sellerAccount, productInfo[_index].price * 1 ether);
    }


    /*
    * [set]
    * processDeliveryCompletionBySeller
    * #params : _index
    * #return :
    *
    * If the buyer does not confirm the receipt for 30 days, the seller can process the transaction himself / herself.
    *
    */
    function processDeliveryCompletionBySeller(uint _index) existProduct(_index) onlySeller(_index) public {
        require(productInfo[_index].state == 2, "Invalid product state");
        require(productInfo[_index].lastStateChangedDate + 30 days <= now, "Available 30 days after delivery.");

        productInfo[_index].state = 3;
        productInfo[_index].lastStateChangedDate = now;
        transferToAddress(productInfo[_index].sellerAccount, productInfo[_index].price * 1 ether);
    }


    /*
    * [set]
    * deletePersonalDataAboutBuyer
    * #params : _index
    * #return :
    *
    * After the transaction is completed, the buyer can delete his / her personal information.
    *
    */
    function deletePersonalDataAboutBuyer(uint _index) onlyBuyer(_index) public {
        require(productInfo[_index].state == 3, "Invalid product state");

        deliveryInfo[_index].buyerPhoneNumber = "deleted";
        deliveryInfo[_index].buyerHomeAddress = "deleted";
    }

    /*
    * [set]
    * deletePersonalDataAboutBuyer
    * #params : _index
    * #return :
    *
    * After the transaction is completed, the seller can delete his / her personal information.
    *
    */
    function deletePersonalDataAboutSeller(uint _index) onlySeller(_index) public {
        require(productInfo[_index].state == 3, "Invalid product state");

        productInfo[_index].sellerPhoneNumber = "deleted";
    }

    /*
    * [sets]
    * declarateProduct
    * #params : _index
    * #return :
    *
    * If there is a problem with the delivery and purchase approval,
    * the seller and the buyer can make an arbitration request to the owner.
    * The product status is modified so that only the owner can change it.
    *
    */
    function declarateProduct(uint _index) existProduct(_index) onlyBuyerOrSeller(_index) public {
      require(productInfo[_index].lastStateChangedDate + 7 <= now, "Available 7 days after last state changed");
        require(productInfo[_index].state >= 1 && productInfo[_index].state < 4, "Invalid product state");

        productInfo[_index].state = 4;
        productInfo[_index].lastStateChangedDate = now;

        DeclarationInfo memory declaration;
        declaration.registerAccount = msg.sender;

        declarationInfo[_index] = declaration;
    }


    /*
    * [sets]
    * processDeclarationByOwner
    * #params : _index, _refundFlag
    * #return :
    *
    * After the owner decides on the commodity for which the arbitration request has been received,
    * it selects the person(buyer/seller) to be paid.
    *
    */
    function processDeclarationByOwner(uint _index, uint _refundFlag) existProduct(_index) existDeclaration(_index) onlyOwner() public{
      require(productInfo[_index].state == 4, "Invalid product state");

      if(_refundFlag == 1){
        productInfo[_index].state = 5;
        productInfo[_index].lastStateChangedDate = now;

        transferToAddress(productInfo[_index].buyerAccount, productInfo[_index].price * 1 ether);
      } else if(_refundFlag ==2){
        productInfo[_index].state = 6;
        productInfo[_index].lastStateChangedDate = now;

        transferToAddress(productInfo[_index].sellerAccount, productInfo[_index].price * 1 ether);
      }
    }

    /*
    * [delete]
    * deleteProductByOwner
    * #params : _index
    * #return :
    *
    * Deletes product information and associated data by owner.
    *
    */
    function deleteProductByOwner(uint _index) existProduct(_index) onlyOwner() public {
        ProductInfo memory product = productInfo[_index];
      require(product.state == 3 || product.state == 5 || product.state == 6, "Invalid product state");

      if(product.state == 3){
        require(product.lastStateChangedDate + 1 days <= now, "Available 30 days after delivery.");
      }else if(product.state == 5 || product.state == 6) {
        require(product.lastStateChangedDate + 15 days <= now, "Available 30 days after delivery.");
        delete declarationInfo[_index];
      }

      delete deliveryInfo[_index];
      delete productInfo[_index];
    }

    /*
    * [delete]
    * deleteProductBySeller
    * #params : _index
    * #return :
    *
    * Deletes product information and associated data by seller.
    *
    */
    function deleteProductBySeller(uint _index) existProduct(_index) onlySeller(_index) public {
        ProductInfo memory product = productInfo[_index];
        require(product.state == 0 || product.state == 3, "Invalid product state");

        delete productInfo[_index];
        delete deliveryInfo[_index];
        delete declarationInfo[_index];
    }


    /*
    * [modifier]
    * existProduct
    * #params : _index
    * #return :
    *
    * Check whether the product exists.
    *
    */
    modifier existProduct(uint _index){
      require(idGenerator >= _index, "Product not found.");
      require(productInfo[_index].id != 0, "Product not found.");
      _;
    }

    /*
    * [modifier]
    * existDeclaration
    * #params : _index
    * #return :
    *
    * Check whether the declaration exists.
    *
    */
    modifier existDeclaration(uint _index){
      require(idGenerator >= _index, "Declaration not found.");
      require(declarationInfo[_index].registerAccount != address(0), "Declaration not found.");
      _;
    }

    /*
    * [modifier]
    * onlySeller
    * #params : _index
    * #return :
    *
    * Make sure the user is a seller.
    *
    */
    modifier onlySeller(uint _index){
      require(productInfo[_index].sellerAccount == msg.sender, "Not authorized.");
      _;
    }

    /*
    * [modifier]
    * onlyBuyer
    * #params : _index
    * #return :
    *
    * Make sure the user is a buyer.
    *
    */
    modifier onlyBuyer(uint _index){
      require(productInfo[_index].buyerAccount == msg.sender, "Not authorized.");
      _;
    }

    /*
    * [modifier]
    * onlyBuyerOrSeller
    * #params : _index
    * #return :
    *
    * Make sure the user is a buyer or seller.
    *
    */
    modifier onlyBuyerOrSeller(uint _index){
      require(productInfo[_index].buyerAccount == msg.sender || productInfo[_index].sellerAccount == msg.sender, "Not authorized.");
      _;
    }

    /*
    * [modifier]
    * onlyStakeHolder
    * #params : _index
    * #return :
    *
    * Make sure the user is a buyer,seller,owner.
    *
    */
    modifier onlyStakeHolder(uint _index){
      require(productInfo[_index].buyerAccount == msg.sender || productInfo[_index].sellerAccount == msg.sender || owner == msg.sender, "Not authorized.");
      _;
    }

    /*
    * [modifier]
    * onlyStakeHolder
    * #params : _index
    * #return :
    *
    * Make sure the user is a owner.
    *
    */
    modifier onlyOwner() {
      require(owner == msg.sender, "Not authorized.");
      _;
    }

    /*
    * [transfer]
    * withdrawFee
    * #params :
    * #return :
    *
    * The owner can withdraw the fee.
    *
    */
    function withdrawFee() onlyOwner() public {
        uint currentFeeAmount = fee;
        fee -= currentFeeAmount;
        owner.transfer(currentFeeAmount);
    }

    /*
    * [transfer]
    * transferToAddress
    * #params : _target , _value
    * #return :
    *
    * Transfers the transaction money securely.
    *
    */
    function transferToAddress(address _target, uint _value) private {
        require(balance >= _value, "Critical error. Not enought balance!");
        balance -= _value;
        _target.transfer(_value);
    }
}
