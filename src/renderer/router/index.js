import Vue from 'vue';
import Router from 'vue-router';

Vue.use(Router);

export default new Router({
  routes: [
    {
      path: '/',
      name: 'welcome-view',
      component: require('@/components/WelcomeView').default
    },
    {
      path: '/config',
      name: 'Config',
      component: require('@/components/ConfigView').default
    },
    {
      path: '/registration',
      name: 'Registration',
      component: require('@/components/RegistrationView').default
    },
    {
      path: '/audit',
      name: 'Audit Log',
      component: require('@/components/AuditView').default
    },
    {
      path: '/node-red',
      name: 'Node-RED',
      component: require('@/components/NodeRedView').default
    },
    {
      path: '*',
      redirect: '/'
    }
  ]
});
