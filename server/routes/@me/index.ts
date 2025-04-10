export default defineEventHandler(async (event) => {
  // TODO: check accept header
  const db = useDatabase()
  const { rows } = await db.sql`SELECT * FROM actor WHERE actor_id = ${me.id}`
  let publicKey: PublicKey | undefined = undefined;
  if (rows?.length === 1) {
    const { actor_id, public_key } = rows[0]

    publicKey = {
      id: `${actor_id}#main-key`,
      owner: `${actor_id}`,
      publicKeyPem: `${public_key}`
    }
  }
  setJsonLdHeader(event)
  return {
    ...me,
    publicKey
  }
})
