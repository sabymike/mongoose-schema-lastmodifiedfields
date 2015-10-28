var mongoose = require('mongoose'),
    _ = require('lodash'),
    async = require('async'),
    should = require('should'),
    sleep = require('sleep'),
    lastModifiedFields = require('..');

mongoose.connect(process.env.MONGODB_URL || 'mongodb://localhost:27017/mongoose-schema-lastmodifiedfields');

var systemKeys = ['_id', '__t', '__v'];
var modifiedFieldSuffix = '_lastModified';
var omittedFields = ['vin'];

describe('Schema Key Tests', function() {
    before(function(done) {
        this.CarSchema = mongoose.Schema({
            make: String,
            model: String,
            vin: String,
            miles: Number
        });

        this.CarSchema.plugin(lastModifiedFields, {
            fieldSuffix: modifiedFieldSuffix,
            omittedFields: omittedFields
        });

        this.Car = mongoose.model('Car', this.CarSchema);

        this.Car.remove(done);
    });

    describe('Creating keys', function() {
        it('should not have created a last modified key on system keys', function() {
            _.each(systemKeys, function(key) {
                this.CarSchema.paths.should.not.have.property(key + modifiedFieldSuffix);
            }, this);
        });

        it('should not have created a last modified key on an omitted field', function() {
            _.each(omittedFields, function(key) {
                this.CarSchema.paths.should.not.have.property(key + modifiedFieldSuffix);
            }, this);
        });

        it('should have created a last modified key for all other user defined properties', function() {
            this.CarSchema.eachPath(function(pathName) {
                var lastModifiedPathName = pathName + modifiedFieldSuffix;
                if (!_.contains(systemKeys, pathName) &&
                    !_.contains(omittedFields, pathName) &&
                    !_.contains(pathName, modifiedFieldSuffix)) {
                    this.CarSchema.paths.should.have.property(lastModifiedPathName);
                }
            }.bind(this));
        });

        it('should expose last modified suffix as a function', function() {
            this.CarSchema.statics.getModifiedFieldSuffix().should.eql(modifiedFieldSuffix);
            this.Car.getModifiedFieldSuffix().should.eql(modifiedFieldSuffix);
        });

        it('should expose the list of paths with last modified suffix as a function', function() {
            var paths = _.invoke(['make', 'model', 'miles'], 'concat', modifiedFieldSuffix);
            this.CarSchema.statics.getModifiedFieldPaths().should.eql(paths);
            this.Car.getModifiedFieldPaths().should.eql(paths);
        });
    });

    describe('Outputting models', function() {
        beforeEach(function() {
            this.newCar = new this.Car({
                make: 'Chevy',
                model: 'Tahoe',
                vin: '12345ABCDE',
                miles: 50000
            });
        });

        it('should include the modified fields when converted to json', function(done) {
            this.newCar.save(function(err, car) {
                var json = car.toJSON();
                json.should.have.property('make' + modifiedFieldSuffix);
                json.should.have.property('model' + modifiedFieldSuffix);
                json.should.have.property('miles' + modifiedFieldSuffix);
                done(err);
            });
        });

        it('should strip modified dates if we tell the plugin to purge them from json', function(done) {
            this.CarSchema.plugin(lastModifiedFields, {
                fieldSuffix: modifiedFieldSuffix,
                omittedFields: omittedFields,
                purgeFromJSON: true
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
            this.CarSchema.plugin(lastModifiedFields, {
                fieldSuffix: modifiedFieldSuffix,
                omittedFields: omittedFields,
                purgeFromObject: true
            });

            this.newCar.save(function(err, car) {
                var obj = car.toObject();
                obj.should.not.have.property('make' + modifiedFieldSuffix);
                obj.should.not.have.property('model' + modifiedFieldSuffix);
                obj.should.not.have.property('miles' + modifiedFieldSuffix);
                done(err);
            });
        });

        it('should omit modified dates if we tell the plugin to not select them from the db', function(done) {
            var self = this;
            this.CarSchema.plugin(lastModifiedFields, {
                fieldSuffix: modifiedFieldSuffix,
                omittedFields: omittedFields,
                select: false
            });

            async.waterfall([
                this.newCar.save,
                function(car, n, cb) {
                    self.Car.findById(car, cb);
                },
                function(car, cb) {
                    should.exist(car.make);
                    should.not.exist(car['make' + modifiedFieldSuffix]);
                    should.exist(car.model);
                    should.not.exist(car['model' + modifiedFieldSuffix]);
                    should.exist(car.miles);
                    should.not.exist(car['miles' + modifiedFieldSuffix]);
                    cb();
                }
            ], done);
        });
    });

    describe('Saving models', function() {
        beforeEach(function() {
            this.newCar = new this.Car({
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
            async.waterfall([
                self.newCar.save,
                function(car, n, cb) {
                    sleep.sleep(2);
                    self.newCar.make = 'Volkswagon';
                    self.newCar.model = 'Jetta';
                    self.now = new Date();
                    self.newCar.save(cb);
                },
                function(car, n, cb) {
                    car.get('make' + modifiedFieldSuffix).should.be.approximately(self.now, 1);
                    car.get('model' + modifiedFieldSuffix).should.be.approximately(self.now, 1);
                    car.get('miles' + modifiedFieldSuffix).should.not.be.approximately(self.now, 1);
                    cb();
                }
            ], done);
        });

        it('should not overwrite modified dates if explicitly set and we tell the plugin to skip', function(done) {
            this.CarSchema.plugin(lastModifiedFields, {
                fieldSuffix: modifiedFieldSuffix,
                omittedFields: omittedFields,
                overwrite: false
            });

            // give this test 5 seconds to complete because we sleep to make sure our timestamps differ
            this.timeout(5000);

            var self = this;
            async.waterfall([
                self.newCar.save,
                function(car, n, cb) {
                    sleep.sleep(2);
                    self.now = new Date();
                    self.newCar.make = 'Volkswagon';
                    self.newCar.set('make' + modifiedFieldSuffix, self.now);
                    self.newCar.model = 'Jetta';
                    self.newCar.set('model' + modifiedFieldSuffix, self.now);
                    sleep.sleep(2);
                    self.newCar.save(cb);
                },
                function(car, n, cb) {
                    car.get('make' + modifiedFieldSuffix).should.be.approximately(self.now, 1);
                    car.get('model' + modifiedFieldSuffix).should.be.approximately(self.now, 1);
                    car.get('miles' + modifiedFieldSuffix).should.not.be.approximately(self.now, 1);
                    cb();
                }
            ], done);
        });

        it('should overwrite modified dates even if explicitly set and overwrite option is true', function(done) {
            this.CarSchema.plugin(lastModifiedFields, {
                fieldSuffix: modifiedFieldSuffix,
                omittedFields: omittedFields,
                overwrite: true
            });

            // give this test 5 seconds to complete because we sleep to make sure our timestamps differ
            this.timeout(5000);

            var self = this;
            async.waterfall([
                self.newCar.save,
                function(car, n, cb) {
                    sleep.sleep(2);
                    var now = new Date();
                    self.newCar.make = 'Volkswagon';
                    self.newCar.set('make' + modifiedFieldSuffix, now);
                    self.newCar.model = 'Jetta';
                    self.newCar.set('model' + modifiedFieldSuffix, now);
                    sleep.sleep(2);
                    self.now = new Date();
                    self.newCar.save(cb);
                },
                function(car, n, cb) {
                    car.get('make' + modifiedFieldSuffix).should.be.approximately(self.now, 1);
                    car.get('model' + modifiedFieldSuffix).should.be.approximately(self.now, 1);
                    car.get('miles' + modifiedFieldSuffix).should.not.be.approximately(self.now, 1);
                    cb();
                }
            ], done);
        });
    });

    describe('Mongoose oddities', function() {
        beforeEach(function() {
            this.newCar = new this.Car({
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

describe('Embedded Type Tests', function() {
    before(function(done) {
        this.CarSchema = mongoose.Schema({
            style: {
                make: String,
                model: String
            },
            vin: String,
            miles: Number
        });

        this.CarSchema.plugin(lastModifiedFields, {
            fieldSuffix: modifiedFieldSuffix,
            omittedFields: omittedFields
        });

        this.Car = mongoose.model('StyleCar', this.CarSchema);

        this.Car.remove(done);
    });

    it('should apply last modified suffix to embedded types', function() {
        this.CarSchema.paths.should.have.property('style.make' + modifiedFieldSuffix);
        this.CarSchema.paths.should.have.property('style.model' + modifiedFieldSuffix);
    });

    describe('Outputting models', function() {
        beforeEach(function() {
            this.newCar = new this.Car({
                style: {
                    make: 'Chevy',
                    model: 'Tahoe'
                },
                vin: '12345ABCDE',
                miles: 50000
            });
        });

        it('should include the modified fields for fields of embedded type', function(done) {
            this.newCar.save(function(err, car) {
                should.exist(car.style['make' + modifiedFieldSuffix]);
                should.exist(car.style['model' + modifiedFieldSuffix]);
                should.exist(car['miles' + modifiedFieldSuffix]);
                done(err);
            });
        });

        it('should omit modified dates if we tell the plugin to not select them from the db', function(done) {
            var self = this;
            this.CarSchema.plugin(lastModifiedFields, {
                fieldSuffix: modifiedFieldSuffix,
                omittedFields: omittedFields,
                select: false
            });

            async.waterfall([
                this.newCar.save,
                function(car, n, cb) {
                    self.Car.findById(car, cb);
                },
                function(car, cb) {
                    should.exist(car.style.make);
                    should.not.exist(car.style['make' + modifiedFieldSuffix]);
                    should.exist(car.style.model);
                    should.not.exist(car.style['model' + modifiedFieldSuffix]);
                    should.exist(car.miles);
                    should.not.exist(car['miles' + modifiedFieldSuffix]);
                    cb();
                }
            ], done);
        });
    });
});
