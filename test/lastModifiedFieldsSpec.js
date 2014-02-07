var mongoose = require("mongoose"),
    _ = require("underscore"),
    should = require("should"),
    async = require("async"),
    sleep = require("sleep"),
    lastModifiedFields = require("../");

var Schema = mongoose.Schema;

mongoose.connect(process.env.MONGODB_URL || "mongodb://localhost:27017/mongoose-schema-lastmodifiedfields");

describe("Schema Key Tests", function() {
    var CarSchema = mongoose.Schema({
        make: String,
        model: String,
        vin: String,
        miles: Number
    });

    var Car = mongoose.model("Car", CarSchema);

    beforeEach(function(done) {
        Car.remove({}, function(err) {
            done(err);
        });
    });

    var systemKeys = ["_id", CarSchema.options.discriminatorKey, CarSchema.options.versionKey];

    var modifiedFieldSuffix = "_lastModified";

    describe("Creating keys", function() {
        before(function() {
            this.schemaPaths = CarSchema.paths;
            this.omittedFields = ["vin"];
            CarSchema.plugin(lastModifiedFields, {fieldSuffix:modifiedFieldSuffix, omittedFields:this.omittedFields});
        });

        it("should not have created a last modified key on system keys", function() {
            _.each(systemKeys, function(key) {
                CarSchema.paths.should.not.have.property(key+modifiedFieldSuffix);
            }, this);
        });

        it("should not have created a last modified key on an omitted field", function() {
            _.each(this.omittedFields, function(key) {
                CarSchema.paths.should.not.have.property(key+modifiedFieldSuffix);
            }, this);
        });

        it("should have created a last modified key for all other user defined properties", function() {
            _.each(this.schemaPaths, function(pathData) {
                var pathName = pathData.path;
                var lastModifiedPathName = pathName+modifiedFieldSuffix;
                if ( systemKeys.indexOf(pathName) === -1 &&
                     this.omittedFields.indexOf(pathName) === -1 &&
                     pathName.indexOf(modifiedFieldSuffix) === -1 )
                {
                    CarSchema.paths.should.have.property(lastModifiedPathName);
                }
            }, this);
        });
    });

    describe("Saving models", function() {
        beforeEach(function() {
            this.newCar = new Car({
                make:"Honda",
                model:"Civic",
                vin:"12345ABCDE",
                miles:20000
            });
        });

        it("should set the current date on all the last modified fields when saving the first time", function(done) {
            var now = new Date();
            this.newCar.save(function(err, car) {
                car.get("make"+modifiedFieldSuffix).should.be.approximately(now, 1);
                car.get("model"+modifiedFieldSuffix).should.be.approximately(now, 1);
                car.get("miles"+modifiedFieldSuffix).should.be.approximately(now, 1);
                done(err);
            });
        });

        it("should only update the last modified fields for the paths that have been changed on later saves", function(done) {
            // give this test 5 seconds to complete because we sleep to make sure our timestamps differ
            this.timeout(5000);

            var self = this;
            async.series([
                function(callback) {
                    self.newCar.save(function(err) {
                        callback(err);
                    });
                },
                function(callback) {
                    sleep.sleep(2);
                    self.newCar.make = "Volkswagon";
                    self.newCar.model = "Jetta";
                    var now = new Date();
                    self.newCar.save(function(err, car) {
                        car.get("make"+modifiedFieldSuffix).should.be.approximately(now, 1);
                        car.get("model"+modifiedFieldSuffix).should.be.approximately(now, 1);
                        car.get("miles"+modifiedFieldSuffix).should.not.be.approximately(now, 1);
                        callback(err);
                    });
                }],
                function(err, result) {
                    done(err);
                });
        });
    });
});