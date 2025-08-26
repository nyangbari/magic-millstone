import { ethers } from "hardhat";

async function main(): Promise<void> {
  const signers = await ethers.getSigners();
  const admin = signers[0];

  const bridgeAddress =
    process.env.BRIDGE_DESTINATION_ADDRESS ||
    "0x4875fA58c1b60f8b6C2358252A302A6D0c823B6d";

  // Replace these with your deployed contract addresses
  const USDT_ADDRESS: string = process.env.USDT_ADDRESS || "YOUR_USDT_ADDRESS";
  const VAULT_ADDRESS: string =
    process.env.VAULT_ADDRESS || "YOUR_VAULT_ADDRESS";

  const testUSDT = await ethers.getContractAt("TestUSDT", USDT_ADDRESS);
  const vaultContract = await ethers.getContractAt(
    "VaultContract",
    VAULT_ADDRESS
  );

  console.log("🪄 Testing magicTime functionality");
  console.log("Admin address:", admin.address);
  console.log("Bridge address:", bridgeAddress);

  // Step 1: Check current vault status
  console.log("\n1️⃣ Current vault status:");
  const vaultBalance = await testUSDT.balanceOf(VAULT_ADDRESS);
  const requiredReserves = await vaultContract.getRequiredReserves();
  const maxTransferable = await vaultContract.getMaxTransferableAmount();
  const bridgeBalance = await vaultContract.bridgeBalance();

  console.log(
    "Vault USDT balance:",
    ethers.formatUnits(vaultBalance, 6),
    "USDT"
  );
  console.log(
    "Required reserves:",
    ethers.formatUnits(requiredReserves, 6),
    "USDT"
  );
  console.log(
    "Max transferable:",
    ethers.formatUnits(maxTransferable, 6),
    "USDT"
  );
  console.log(
    "Current bridge balance:",
    ethers.formatUnits(bridgeBalance, 6),
    "USDT"
  );

  // Step 2: Test magicTime
  console.log("\n2️⃣ Testing magicTime (static call):");
  try {
    const staticResult = await (vaultContract as any).magicTime.staticCall(
      bridgeAddress
    );

    console.log("Static call result:");
    console.log(
      "Amount that would be sent:",
      ethers.formatUnits(staticResult[0], 6),
      "USDT"
    );
    console.log(
      "Amount needed (if insufficient):",
      ethers.formatUnits(staticResult[1], 6),
      "USDT"
    );

    if (staticResult[0] > 0n) {
      console.log("✅ magicTime would send funds to bridge");
    } else {
      console.log("❌ magicTime would fail - need more funds in vault");
    }
  } catch (error) {
    console.log("❌ Static call error:", error);
  }

  // Step 3: Execute actual magicTime
  console.log("\n3️⃣ Executing magicTime:");
  try {
    const tx = await (vaultContract as any)
      .connect(admin)
      .magicTime(bridgeAddress);
    console.log("Transaction sent:", tx.hash);

    const receipt = await tx.wait();
    console.log("✅ Confirmed in block:", receipt.blockNumber);

    const actualResult = await (vaultContract as any).magicTime.staticCall(
      bridgeAddress
    );
    console.log("\n📊 Actual function return values:");
    console.log("Amount sent:", ethers.formatUnits(actualResult[0], 6), "USDT");
    console.log(
      "Amount needed:",
      ethers.formatUnits(actualResult[1], 6),
      "USDT"
    );

    // Check event logs
    const bridgeTransferEvents = receipt.logs.filter((log: any) => {
      try {
        const parsed = vaultContract.interface.parseLog(log);
        return parsed && parsed.name === "BridgeTransfer";
      } catch {
        return false;
      }
    });

    if (bridgeTransferEvents.length > 0) {
      const parsed = vaultContract.interface.parseLog(bridgeTransferEvents[0]);
      if (parsed) {
        console.log("🎉 BridgeTransfer event emitted:");
        console.log("  Destination:", parsed.args.destination);
        console.log(
          "  Amount:",
          ethers.formatUnits(parsed.args.amount, 6),
          "USDT"
        );
      }
    } else {
      console.log("ℹ️ No BridgeTransfer event - likely insufficient funds");
    }
  } catch (error) {
    console.log("❌ Transaction error:", error);
  }

  // Step 4: Check final status
  console.log("\n4️⃣ Final vault status:");
  const finalVaultBalance = await testUSDT.balanceOf(VAULT_ADDRESS);
  const finalBridgeBalance = await vaultContract.bridgeBalance();
  const finalBridgeUsdtBalance = await testUSDT.balanceOf(bridgeAddress);

  console.log(
    "Final vault USDT balance:",
    ethers.formatUnits(finalVaultBalance, 6),
    "USDT"
  );
  console.log(
    "Final bridge balance (tracking):",
    ethers.formatUnits(finalBridgeBalance, 6),
    "USDT"
  );
  console.log(
    "Bridge address USDT balance:",
    ethers.formatUnits(finalBridgeUsdtBalance, 6),
    "USDT"
  );

  // Step 5: Show the difference
  console.log("\n5️⃣ Transaction Summary:");
  const vaultBalanceChange = vaultBalance - finalVaultBalance;
  const bridgeBalanceChange = finalBridgeBalance - bridgeBalance;

  if (vaultBalanceChange > 0) {
    console.log(
      "✅ Vault sent:",
      ethers.formatUnits(vaultBalanceChange, 6),
      "USDT"
    );
    console.log(
      "✅ Bridge received:",
      ethers.formatUnits(bridgeBalanceChange, 6),
      "USDT"
    );
  } else {
    console.log("ℹ️ No funds transferred - vault needs more USDT");
  }

  console.log("\n🪄 magicTime test completed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
