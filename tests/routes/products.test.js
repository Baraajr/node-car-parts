const supertest = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const app = require('../../app');
const {
  CreateCategory,
  createProduct,
  createAdminUser,
  createReqularUser,
  createJWTToken,
  deleteAllProducts,
  deleteAllCategories,
} = require('../helpers/helper');

let adminToken;
let categoryId;
let userToken;
let mongoServer;
let productId;

beforeAll(async () => {
  // Start MongoDB in-memory server
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri(), {});

  // create admin and regular user
  const adminUser = await createAdminUser(); // Await user creation
  adminToken = createJWTToken(adminUser._id); // Generate token after user is created
  const regularUser = await createReqularUser(); // Await user creation
  userToken = createJWTToken(regularUser._id); // Generate token after user is created
});

afterAll(async () => {
  await mongoose.connection.db.dropDatabase(); // Clean up the database
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // create category
  const category = await CreateCategory();
  categoryId = category._id;

  // create  a new product to test the get specific route
  const product = await createProduct(category._id); // Set up new product
  productId = product._id;
});

afterEach(async () => {
  await deleteAllProducts();
  await deleteAllCategories();
});

describe('Testing Products routes ', () => {
  describe('/api/v1/products', () => {
    describe('GET /api/v1/products ', () => {
      test('should return an array of products', async () => {
        const response = await supertest(app).get('/api/v1/products');
        expect(response.status).toEqual(200);
        expect(Array.isArray(response.body.data.documents)).toBeTruthy();
      });
    });

    describe('POST /api/v1/products', () => {
      describe('without a login token', () => {
        test('should return 401 Unauthorized', async () => {
          const response = await supertest(app).post('/api/v1/products').send({
            name: 'Test Product 2',
            price: 200,
            description: 'Test product description 2',
            category: categoryId,
            color: 'Test Color 2',
            quantity: 5,
          });
          expect(response.status).toEqual(401);
          expect(response.body.message).toBe(
            'You are not logged in. Please log in to get access.',
          );
        });
      });

      describe('with regular user token', () => {
        test('Should returns 403 Forbidden', async () => {
          const response = await supertest(app)
            .post('/api/v1/products')
            .set('Authorization', `Bearer ${userToken}`)
            .send({
              name: 'Test Product 2',
              price: 200,
              description: 'Test product description 2',
              category: categoryId,
              color: 'Test Color 2',
              quantity: 5,
            });

          expect(response.status).toEqual(403);
          expect(response.body.message).toBe(
            'you do not have permission to perform this action',
          );
        });
      });

      describe('with Admin token', () => {
        describe('with all required fields', () => {
          test('should Return 201 Created', async () => {
            const response = await supertest(app)
              .post('/api/v1/products')
              .set('Authorization', `Bearer ${adminToken}`)
              .send({
                name: 'Test Product 2',
                price: 200,
                description: 'Test product description 2',
                category: categoryId,
                color: 'Test Color 2',
                quantity: 5,
              });

            // console.log(response.body);
            expect(response.status).toEqual(201);
            expect(response.body.data.doc).toHaveProperty(
              'name',
              'Test Product 2',
            );
            expect(response.body.data.doc).toHaveProperty('price', 200);
          });
        });
        describe('with missing required fields', () => {
          test('should return 400 Bad Request', async () => {
            const response = await supertest(app)
              .post('/api/v1/products')
              .set('Authorization', `Bearer ${adminToken}`)
              .send({
                name: 'Test Product 2',
                price: 200,
                description: 'Test product description 2',
                color: 'Test Color 2',
                quantity: 5,
              });
            expect(response.status).toEqual(400);
            expect(response.body.message).toBe(
              'Please provide all required fields',
            );
          });
        });
      });
    });
  });

  describe('/api/v1/products/:id', () => {
    describe('GET /api/v1/products/:id if found', () => {
      test('should return a single product', async () => {
        const response = await supertest(app).get(
          `/api/v1/products/${productId}`,
        );
        expect(response.status).toEqual(200);
        expect(response.body.data.doc).toHaveProperty('name', 'Test Product');
      });
    });

    describe('GET /api/v1/products/:id', () => {
      test('should return 404 if product not found', async () => {
        const response = await supertest(app).get(
          '/api/v1/products/66cc5aa7be03da97c6b07583',
        );
        expect(response.statusCode).toEqual(404);
        expect(response.body.message).toBe(
          'No Document with this ID 66cc5aa7be03da97c6b07583',
        );
      });
    });

    describe('GET /api/v1/products with InvalidId', () => {
      test('Should return 400 Invalid Id', async () => {
        const response = await supertest(app).get('/api/v1/products/invalidId');
        expect(response.status).toEqual(400);
        expect(response.body.message).toMatch('Invalid ID');
        expect(response.body.message).toEqual(
          expect.stringContaining('Invalid ID'),
        );
      });
    });

    describe('PATCH /api/v1/products/:id', () => {
      test('should return 404 if product not found', async () => {
        const response = await supertest(app)
          .patch(`/api/v1/products/${productId}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            name: 'Updated Product',
            price: 250,
            description: 'Updated product description',
            category: categoryId,
            color: 'Updated Color',
            quantity: 3,
          });
        expect(response.statusCode).toEqual(200);
        expect(response.body.data.doc).toHaveProperty(
          'name',
          'Updated Product',
        );
        expect(response.body.data.doc).toHaveProperty('price', 250);
      });
    });

    describe('DELETE /api/v1/products/:id', () => {
      test('should return 403 Forbidden if not Admin', async () => {
        const response = await supertest(app)
          .delete(`/api/v1/products/${productId}`)
          .set('Authorization', `Bearer ${userToken}`);
        expect(response.status).toBe(403);
        expect(response.body.message).toBe(
          'you do not have permission to perform this action',
        );
      });

      test('should return 401 Unauthorized if not logged in', async () => {
        const response = await supertest(app)
          .delete(`/api/v1/products/${productId}`)
          .set('Authorization', `Bearer`);
        expect(response.status).toBe(401);
        expect(response.body.message).toBe(
          'You are not logged in. Please log in to get access.',
        );
      });

      test('should return 204 No Content if product found and deleted', async () => {
        const response = await supertest(app)
          .delete(`/api/v1/products/${productId}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(response.status).toBe(204);
      });
    });

    describe('DELETE /api/v1/products/:id', () => {
      test('Should return 400 Invalid Id if used InvalidId', async () => {
        const response = await supertest(app)
          .delete('/api/v1/products/invalidId')
          .set('Authorization', `Bearer ${adminToken}`);
        expect(response.status).toBe(400);
        expect(response.body.message).toMatch('Invalid ID');
        expect(response.body.message).toEqual(
          expect.stringContaining('Invalid ID'),
        );
      });
    });
  });
});
