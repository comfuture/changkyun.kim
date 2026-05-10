export default defineEventHandler(async (_event) => {
  await runTask('db:seed')
  return { result: true }
})
