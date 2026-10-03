#!/usr/bin/env node

/**
 * Apollo Integration Test Script
 * Tests the enrichment service in isolation
 */

const {
  enrichFromApollo,
} = require("./lib/prospects/apollo-enrichment-service");

async function testApolloEnrichment() {
  console.log("🧪 Testing Apollo.io Enrichment Service\n");
  console.log("=".repeat(60));

  // Test Case 1: Email-based enrichment
  console.log("\n📧 Test 1: Email-based enrichment");
  console.log("-".repeat(60));

  const testProfile1 = {
    id: "test_1",
    email: "elon@tesla.com",
    currentStep: "VALIDATE",
    status: "PENDING",
    qualityScore: 0,
    confidenceScore: 0,
    reviewRequired: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const result1 = await enrichFromApollo(testProfile1);
    if (result1) {
      console.log("✅ Enrichment successful");
      console.log(`   Confidence: ${result1.confidence}%`);
      console.log(
        `   Person: ${result1.person?.firstName} ${result1.person?.lastName}`,
      );
      console.log(`   Title: ${result1.person?.title || "N/A"}`);
      console.log(`   Company: ${result1.company?.name || "N/A"}`);
      console.log(`   Industry: ${result1.company?.industry || "N/A"}`);
    } else {
      console.log("⚠️  No enrichment data found");
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  // Test Case 2: Company domain enrichment
  console.log("\n🏢 Test 2: Company domain enrichment");
  console.log("-".repeat(60));

  const testProfile2 = {
    id: "test_2",
    companyWebsite: "https://stripe.com",
    currentStep: "VALIDATE",
    status: "PENDING",
    qualityScore: 0,
    confidenceScore: 0,
    reviewRequired: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const result2 = await enrichFromApollo(testProfile2);
    if (result2) {
      console.log("✅ Company enrichment successful");
      console.log(`   Confidence: ${result2.confidence}%`);
      console.log(`   Company: ${result2.company?.name || "N/A"}`);
      console.log(`   Industry: ${result2.company?.industry || "N/A"}`);
      console.log(`   Size: ${result2.company?.size || "N/A"}`);
      console.log(`   Country: ${result2.company?.country || "N/A"}`);
    } else {
      console.log("⚠️  No enrichment data found");
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  // Test Case 3: Graceful failure (no data)
  console.log("\n🚫 Test 3: Graceful failure handling");
  console.log("-".repeat(60));

  const testProfile3 = {
    id: "test_3",
    firstName: "NonExistent",
    lastName: "Person",
    currentStep: "VALIDATE",
    status: "PENDING",
    qualityScore: 0,
    confidenceScore: 0,
    reviewRequired: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const result3 = await enrichFromApollo(testProfile3);
    if (result3) {
      console.log("✅ Unexpected enrichment found");
    } else {
      console.log("✅ Gracefully handled (no data found)");
    }
  } catch (error) {
    console.log("❌ Error:", error.message);
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎯 Test suite completed\n");
}

// Run tests
testApolloEnrichment().catch(console.error);
