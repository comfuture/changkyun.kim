export default defineEventHandler(async (event) => {
  await runTask('db:seed')
  return { result: true }
})
