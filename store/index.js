export const state = () => ({
  user: null
})

export const getters = {
  user: state => state.user
}

export const mutations = {
  setUser(state, { authUser }) {
    if (authUser) {
      let { uid, email, emailVerified, displayName, role } = authUser
      state.user = { uid, email, emailVerified, displayName, role }
    } else {
      state.user = null
    }
  }
}
