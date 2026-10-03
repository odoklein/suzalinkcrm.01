const dns = require("dns");

async function testDNS() {
  console.log("--- DNS Test ---");
  const host = "api.mistral.ai";
  dns.lookup(host, (err, address, family) => {
    if (err) {
      console.error(`dns.lookup failed for ${host}:`, err);
    } else {
      console.log(`dns.lookup for ${host}: ${address} (family: ${family})`);
    }
  });

  dns.resolve4(host, (err, addresses) => {
    if (err) {
      console.error(`dns.resolve4 failed for ${host}:`, err);
    } else {
      console.log(`dns.resolve4 for ${host}:`, addresses);
    }
  });
}

async function testFetch() {
  console.log("--- Fetch Test ---");
  try {
    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "test" }),
    });
    console.log("Fetch response status:", res.status);
  } catch (e) {
    console.error("Fetch failed:", e);
  }
}

testDNS();
testFetch();
