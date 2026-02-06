
async function test() {
  const baseUrl = 'http://localhost:3001/api';
  console.log('Logging in...');
  
  try {
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'WEBADMIN', password: '123' }) 
    });
    
    if (!loginRes.ok) {
        console.error('Login HTTP error:', loginRes.status, await loginRes.text());
        return;
    }

    const loginData = await loginRes.json();
    console.log('Login success:', loginData.success);
    
    if(!loginData.success) {
        console.error('Login failed:', loginData);
        return;
    }
    
    const token = loginData.data?.token || loginData.token;
    console.log('Token obtained.'); 
    if (loginData.data?.user) {
        console.log('User DB:', loginData.data.user.db_name);
    }
    
    console.log('Fetching bodegas...');
    const bodegasRes = await fetch(`${baseUrl}/bodegas`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!bodegasRes.ok) {
        console.error('Bodegas HTTP error:', bodegasRes.status, await bodegasRes.text());
        return;
    }

    const bodegasData = await bodegasRes.json();
    console.log('Bodegas response:', JSON.stringify(bodegasData, null, 2));

  } catch (err) {
      console.error('Error:', err);
  }
}

test();
