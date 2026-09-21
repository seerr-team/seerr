// Must stay import-free, entity decorators read this during datasource evaluation
export const isPgsql = process.env.DB_TYPE === 'postgres';
