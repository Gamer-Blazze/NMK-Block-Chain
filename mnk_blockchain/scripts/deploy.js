import { ethers } from "hardhat";

async function main() {
  const initialSupply = ethers.parseUnits("1000000", 18);
  const NMK = await ethers.getContractFactory("NMKToken");
  const nmk = await NMK.deploy(initialSupply);
  await nmk.waitForDeployment();
  console.log("NMK deployed to:", await nmk.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
