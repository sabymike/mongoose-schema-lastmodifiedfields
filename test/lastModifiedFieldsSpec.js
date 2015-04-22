var mongoose = require('mongoose'),
    _ = require('lodash'),
    async = require('async'),
    sleep = require('sleep'),
    lastModifiedFields = require('..');

require('should');

mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/mongoose-schema-lastmodifiedfields');

var CarSchema = mongoose.Schema({
    make: String,
    model: String,
    vin: String,
    miles: Number
});

var systemKeys = ['_id', CarSchema.options.discriminatorKey, CarSchema.options.versionKey];
var modifiedFieldSuffix = '_lastModified';
var omittedFields = ['vin'];

CarSchema.plugin(lastModifiedFields, {
    fieldSuffix: modifiedFieldSuffix,
    omittedFields: omittedFields
});

var Car = mongoose.model('Car', CarSchema);

describe('Schema Key Tests', function() {

    beforeEach(function(done) {
        Car.remove({}, done);
    });

    describe('Creating keys', function() {
        before(function() {
            this.schemaPaths = CarSchema.paths;
        });

        it('should not have created a last modified key on system keys', function() {
            _.each(systemKeys, function(key) {
                CarSchema.paths.should.not.have.property(key + modifiedFieldSuffix);
            }, this);
        });

        it('should not have created a last modified key on an omitted field', function() {
            _.each(omittedFields, function(key) {
                CarSchema.paths.should.not.have.property(key + modifiedFieldSuffix);
            }, this);
        });

        it('should have created a last modified key for all other user defined properties', function() {
            _.each(this.schemaPaths, function(pathData) {
                var pathName = pathData.path;
                var lastModifiedPathName = pathName + modifiedFieldSuffix;
                if (!_.contains(systemKeys, pathName) &&
                    !_.contains(omittedFields, pathName) &&
                    !_.contains(pathName, modifiedFieldSuffix)) {
                    CarSchema.paths.should.have.property(lastModifiedPathName);
                }
            }, this);
        });

        it('should expose last modified suffix as a function', function() {
            CarSchema.statics.getModifiedFieldSuffix().should.eql(modifiedFieldSuffix);
            Car.getModifiedFieldSuffix().should.eql(modifiedFieldSuffix);
        });
    });

    describe('Outputting models', function() {
        it('should include the modified fields when converted to json', function(done) {
            this.newCar = new Car({
                make: 'Chevy',
                model: 'Tahoe',
                vin: '12345ABCDE',
                miles: 50000
            });

            this.newCar.save(function(err, car) {
                var json = car.toJSON();
                json.should.have.property('make' + modifiedFieldSuffix);
                json.should.have.property('model' + modifiedFieldSuffix);
                json.should.have.property('miles' + modifiedFieldSuffix);
                done(err);
            });
        });

        it('should strip modified dates if we tell the plugin to purge them from json', function(done) {
            CarSchema.plugin(lastModifiedFields, {
                fieldSuffix: modifiedFieldSuffix,
                omittedFields: omittedFields,
                purgeFromJSON: true
            });
            this.newCar = new Car({
                make: 'Chevy',
                model: 'Tahoe',
                vin: '12345ABCDE',
                miles: 50000
            });

            this.newCar.save(function(err, car) {
                var json = car.toJSON();
                json.should.not.have.property('make' + modifiedFieldSuffix);
                json.should.not.have.property('model' + modifiedFieldSuffix);
                json.should.not.have.property('miles' + modifiedFieldSuffix);
                done(err);
            });
        });

        it('should strip modified dates if we tell the plugin to purge them from the object', function(done) {
            CarSchema.plugin(lastModifiedFields, {
                fieldSuffix: modifiedFieldSuffix,
                omittedFields: omittedFields,
                purgeFromObject: true
            });
            this.newCar = new Car({
                make: 'Chevy',
                model: 'Tahoe',
                vin: '12345ABCDE',
                miles: 50000
            });

            this.newCar.save(function(err, car) {
                var obj = car.toObject();
                obj.should.not.have.property('make' + modifiedFieldSuffix);
                obj.should.not.have.property('model' + modifiedFieldSuffix);
                obj.should.not.have.property('miles' + modifiedFieldSuffix);
                done(err);
            });
        });
    });

    describe('Saving models', function() {
        beforeEach(function() {
            this.newCar = new Car({
                make: 'Honda',
                model: 'Civic',
                vin: '12345ABCDE',
                miles: 20000
            });
        });

        it('should set the current date on all the last modified fields when saving the first time', function(done) {
            var now = new Date();
            this.newCar.save(function(err, car) {
                car.get('make' + modifiedFieldSuffix).should.be.approximately(now, 1);
                car.get('model' + modifiedFieldSuffix).should.be.approximately(now, 1);
                car.get('miles' + modifiedFieldSuffix).should.be.approximately(now, 1);
                done(err);
            });
        });

        it('should only update the last modified fields for the paths that have been changed on later saves', function(done) {
            // give this test 3 seconds to complete because we sleep to make sure our timestamps differ
            this.timeout(3000);

            var self = this;
            async.series([
                    function(callback) {
                        self.newCar.save(callback);
                    },
                    function(callback) {
                        sleep.sleep(2);
                        self.newCar.make = 'Volkswagon';
                        self.newCar.model = 'Jetta';
                        var now = new Date();
                        self.newCar.save(function(err, car) {
                            car.get('make' + modifiedFieldSuffix).should.be.approximately(now, 1);
                            car.get('model' + modifiedFieldSuffix).should.be.approximately(now, 1);
                            car.get('miles' + modifiedFieldSuffix).should.not.be.approximately(now, 1);
                            callback(err);
                        });
                    }
                ],
                done);
        });

        it('should not overwrite modified dates if explicitly set and we tell the plugin to skip', function(done) {
            CarSchema.plugin(lastModifiedFields, {
                fieldSuffix: modifiedFieldSuffix,
                omittedFields: omittedFields,
                overwrite: false
            });

            // give this test 5 seconds to complete because we sleep to make sure our timestamps differ
            this.timeout(5000);

            var self = this;
            async.series([
                    function(callback) {
                        self.newCar.save(callback);
                    },
                    function(callback) {
                        sleep.sleep(2);
                        var now = new Date();
                        self.newCar.make = 'Volkswagon';
                        self.newCar.set('make' + modifiedFieldSuffix, now);
                        self.newCar.model = 'Jetta';
                        self.newCar.set('model' + modifiedFieldSuffix, now);
                        sleep.sleep(2);
                        self.newCar.save(function(err, car) {
                            car.get('make' + modifiedFieldSuffix).should.be.approximately(now, 1);
                            car.get('model' + modifiedFieldSuffix).should.be.approximately(now, 1);
                            car.get('miles' + modifiedFieldSuffix).should.not.be.approximately(now, 1);
                            callback(err);
                        });
                    }
                ],
                done);
        });

        it('should overwrite modified dates even if explicitly set and overwrite option is true', function(done) {
            CarSchema.plugin(lastModifiedFields, {
                fieldSuffix: modifiedFieldSuffix,
                omittedFields: omittedFields,
                overwrite: true
            });

            // give this test 5 seconds to complete because we sleep to make sure our timestamps differ
            this.timeout(5000);

            var self = this;
            async.series([
                    function(callback) {
                        self.newCar.save(callback);
                    },
                    function(callback) {
                        sleep.sleep(2);
                        var now = new Date();
                        self.newCar.make = 'Volkswagon';
                        self.newCar.set('make' + modifiedFieldSuffix, now);
                        self.newCar.model = 'Jetta';
                        self.newCar.set('model' + modifiedFieldSuffix, now);
                        sleep.sleep(2);
                        now = new Date();
                        self.newCar.save(function(err, car) {
                            car.get('make' + modifiedFieldSuffix).should.be.approximately(now, 1);
                            car.get('model' + modifiedFieldSuffix).should.be.approximately(now, 1);
                            car.get('miles' + modifiedFieldSuffix).should.not.be.approximately(now, 1);
                            callback(err);
                        });
                    }
                ],
                done);
        });
    });

    describe('Mongoose oddities', function() {
        beforeEach(function() {

            this.newCar = new Car({
                make: 'Subaru',
                model: 'Outback',
                vin: '12345ABCDE',
                miles: 100000
            });
        });

        it('should not have lastModifiedFields in modifiedPaths() when assigned', function(done) {
            // give this test 3 seconds to complete because we sleep to make sure our timestamps differ
            this.timeout(3000);

            this.newCar.save(function(err, car) {
                sleep.sleep(2);
                car.make = 'Volkswagon';
                car['make' + modifiedFieldSuffix] = new Date();
                car.modifiedPaths().should.not.containEql(['make' + modifiedFieldSuffix]);
                done(err);
            });
        });

        it('should have lastModifiedFields in modifiedPaths() after calling `markModified`', function(done) {
            // give this test 3 seconds to complete because we sleep to make sure our timestamps differ
            this.timeout(3000);

            this.newCar.save(function(err, car) {
                sleep.sleep(2);
                car.make = 'Volkswagon';
                car['make' + modifiedFieldSuffix] = new Date();
                car.markModified('make' + modifiedFieldSuffix);
                car.modifiedPaths().should.eql(['make', 'make' + modifiedFieldSuffix]);
                done(err);
            });
        });

        it('should have lastModifiedFields in modifiedPaths() when explicitly `set`', function(done) {
            // give this test 3 seconds to complete because we sleep to make sure our timestamps differ
            this.timeout(3000);

            this.newCar.save(function(err, car) {
                sleep.sleep(2);
                car.make = 'Volkswagon';
                car.set('make' + modifiedFieldSuffix, new Date());
                car.modifiedPaths().should.eql(['make', 'make' + modifiedFieldSuffix]);
                done(err);
            });
        });

    });
});
