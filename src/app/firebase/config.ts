// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA5gaPFRs3bucgL5OlNgABlmoIpn0dRgho",
  authDomain: "anhlt67-85ac4.firebaseapp.com",
  databaseURL: "https://anhlt67-85ac4-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "anhlt67-85ac4",
  storageBucket: "anhlt67-85ac4.firebasestorage.app",
  messagingSenderId: "996659001839",
  appId: "1:996659001839:web:234b353f2cd4cc183a1e1a",
  measurementId: "G-VYYHZH661N"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);