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
    var omittedFields = ['vin'];

    CarSchema.plugin(lastModifiedFields, {fieldSuffix:modifiedFieldSuffix, omittedFields:omittedFields});

    describe("Creating keys", function() {
        before(function() {
            this.schemaPaths = CarSchema.paths;
        });

        it("should not have created a last modified key on system keys", function() {
            _.each(systemKeys, function(key) {
                CarSchema.paths.should.not.have.property(key+modifiedFieldSuffix);
            }, this);
        });

        it("should not have created a last modified key on an omitted field", function() {
            _.each(omittedFields, function(key) {
                CarSchema.paths.should.not.have.property(key+modifiedFieldSuffix);
            }, this);
        });

        it("should have created a last modified key for all other user defined properties", function() {
            _.each(this.schemaPaths, function(pathData) {
                var pathName = pathData.path;
                var lastModifiedPathName = pathName+modifiedFieldSuffix;
                if ( systemKeys.indexOf(pathName) === -1 &&
                     omittedFields.indexOf(pathName) === -1 &&
                     pathName.indexOf(modifiedFieldSuffix) === -1 )
                {
                    CarSchema.paths.should.have.property(lastModifiedPathName);
                }
            }, this);
        });
    });

    describe("Outputting models", function() {
        it("should include the modified fields when converted to json", function(done) {
            this.newCar = new Car({
                make:"Chevy",
                model:"Tahoe",
                vin:"12345ABCDE",
                miles:50000
            });

            this.newCar.save(function(err, car) {
                var json = car.toJSON();
                json.should.have.property("make"+modifiedFieldSuffix);
                json.should.have.property("model"+modifiedFieldSuffix);
                json.should.have.property("miles"+modifiedFieldSuffix);
                done(err);
            });
        });

        it("should strip modified dates if we tell the plugin to purge them from json", function(done) {
            CarSchema.plugin(lastModifiedFields, {fieldSuffix:modifiedFieldSuffix, omittedFields:omittedFields, purgeFromJSON:true});
            this.newCar = new Car({
                make:"Chevy",
                model:"Tahoe",
                vin:"12345ABCDE",
                miles:50000
            });

            this.newCar.save(function(err, car) {
                var json = car.toJSON();
                json.should.not.have.property("make"+modifiedFieldSuffix);
                json.should.not.have.property("model"+modifiedFieldSuffix);
                json.should.not.have.property("miles"+modifiedFieldSuffix);
                done(err);
            });
        });

        it("should strip modified dates if we tell the plugin to purge them from the object", function(done) {
            CarSchema.plugin(lastModifiedFields, {fieldSuffix:modifiedFieldSuffix, omittedFields:omittedFields, purgeFromObject:true});
            this.newCar = new Car({
                make:"Chevy",
                model:"Tahoe",
                vin:"12345ABCDE",
                miles:50000
            });

            this.newCar.save(function(err, car) {
                var obj = car.toObject();
                obj.should.not.have.property("make"+modifiedFieldSuffix);
                obj.should.not.have.property("model"+modifiedFieldSuffix);
                obj.should.not.have.property("miles"+modifiedFieldSuffix);
                done(err);
            });
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