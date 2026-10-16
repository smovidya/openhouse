// Define a strict Zod object for the actual questionnaire when its fields are
// decided, and infer its input type with z.infer. Avoid accepting arbitrary JSON
// just because the database stores the response in a JSON column.
export {};
