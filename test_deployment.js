// Test script to verify deployment
// Run this in the browser console on your deployed frontend

async function testDeployment() {
    console.log('Testing deployment...');
    
    // Test 1: Check if backend is accessible
    try {
        const response = await fetch('https://clio-backend.onrender.com/api/health');
        const data = await response.json();
        console.log('✅ Backend health check:', data);
    } catch (error) {
        console.error('❌ Backend health check failed:', error);
    }
    
    // Test 2: Test CORS with test endpoint
    try {
        const response = await fetch('https://clio-backend.onrender.com/api/test');
        const data = await response.json();
        console.log('✅ CORS test:', data);
    } catch (error) {
        console.error('❌ CORS test failed:', error);
    }
    
    // Test 3: Test projects endpoint
    try {
        const response = await fetch('https://clio-backend.onrender.com/api/projects');
        const data = await response.json();
        console.log('✅ Projects endpoint:', data);
    } catch (error) {
        console.error('❌ Projects endpoint failed:', error);
    }
    
    // Test 4: Test from frontend domain
    try {
        const response = await fetch('/api/test');
        const data = await response.json();
        console.log('✅ Frontend API test:', data);
    } catch (error) {
        console.error('❌ Frontend API test failed:', error);
    }
}

// Run the test
testDeployment(); 