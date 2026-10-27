/** Lets non-component code (the sync engine) redirect with the router. Set once by <NavBridge/> in App. */
let nav = null
export const setNavigator = (fn) => {
  nav = fn
}
export const goHome = () => (nav ? nav('/', { replace: true }) : window.location.assign('/'))
