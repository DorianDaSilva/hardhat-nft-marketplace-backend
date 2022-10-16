const { assert, expect } = require("chai")
const { network, deployments, ethers } = require("hardhat")
const { developmentChains } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Unit Tests", function () {
          let nftMarketplace, basicNft, deployer, user
          const PRICE = ethers.utils.parseEther("0.1")
          const TOKEN_ID = 0

          beforeEach(async function () {
              const accounts = await ethers.getSigners()
              deployer = accounts[0]
              user = accounts[1]
              await deployments.fixture(["all"])
              nftMarketplace = await ethers.getContract("NftMarketplace")
              basicNft = await ethers.getContract("BasicNFT")
              await basicNft.mintNft()
              await basicNft.approve(nftMarketplace.address, TOKEN_ID)
          })

          it("lists and can be bought", async function () {
              //Deployer owns the NFT and is listing it
              await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
              //We want the user to buy it - connect user to marketplace
              const userConnectedNftMarketplace = nftMarketplace.connect(user)
              //Buy the item
              await userConnectedNftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                  value: PRICE,
              })
              //Check if the player owns the NFT
              const newOwner = await basicNft.ownerOf(TOKEN_ID)
              //Check that the deployer got paid
              const deployerProceeds = await nftMarketplace.getProceeds(deployer.address)
              //assert new owner
              assert(newOwner.toString() == user.address)
              //assert proceeds -> they have gotten paid that price
              assert(deployerProceeds.toString() == PRICE.toString())
          })

          describe("listItem", function () {
              it("emits an event after listing an item", async function () {
                  expect(await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed"
                  )
              })

              it("exclusively items that haven't been listed", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("AlreadyListed")
              })

              it("Allows only owner to list item", async function () {
                  nftMarketplace = nftMarketplace.connect(user)
                  await basicNft.approve(user.address, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotOwner")
              })

              it("needs approval to list item", async function () {
                  await basicNft.approve(ethers.constants.AddressZero, TOKEN_ID)
                  await expect(
                      nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotApprovedForMarketplace")
              })

              it("Updates listing with seller and price info", async function () {
                  await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                  const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                  assert(listing.price.toString() == PRICE.toString())
                  assert(listing.seller.toString() == deployer.address)
              })

              describe("CancelListing", function () {
                  it("reverts if there is no listing", async function () {
                      const error = `NotListed("${basicNft.address}", ${TOKEN_ID})`
                      expect(
                          nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                      ).to.be.revertedWith(error)
                  })

                  it("reverts if anyone but the owner tries to call", async function () {
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      nftMarketplace = nftMarketplace.connect(user)
                      await basicNft.approve(user.address, TOKEN_ID)
                      await expect(
                          nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                      ).to.be.revertedWith("NotOwner")
                  })

                  it("emits event & removes the listing", async function () {
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      expect(
                          await nftMarketplace.cancelListing(basicNft.address, TOKEN_ID)
                      ).to.emit("ItemCanceled")
                      const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                      assert(listing.price.toString() == "0")
                  })
              })

              describe("buyItem", function () {
                  it("reverts if the item isn't listed", async function () {
                      const error = `NotListed("${basicNft.address}", ${TOKEN_ID})`
                      expect(
                          nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                      ).to.be.revertedWith(error)
                  })

                  it("reverts if the price isn't met", async function () {
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      await expect(
                          nftMarketplace.buyItem(basicNft.address, TOKEN_ID)
                      ).to.be.revertedWith("PriceNotMet")
                  })

                  it("transfer NFT to new owner & update proceeds internally", async function () {
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      nftMarketplace = nftMarketplace.connect(user)
                      expect(
                          await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, {
                              value: PRICE,
                          })
                      ).to.emit("ItemBought")
                      const newOwner = await basicNft.ownerOf(TOKEN_ID)
                      const deployerProceeds = await nftMarketplace.getProceeds(deployer.address)
                      assert(newOwner.toString() == user.address)
                      assert(deployerProceeds.toString() == PRICE.toString())
                  })
              })

              describe("updateListing", function () {
                  it("must be owner and listed", async function () {
                      it("must be owner and listed", async function () {
                          await expect(
                              nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                          ).to.be.revertedWith("NotListed")
                          await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                          nftMarketplace = nftMarketplaceContract.connect(user)
                          await expect(
                              nftMarketplace.updateListing(basicNft.address, TOKEN_ID, PRICE)
                          ).to.be.revertedWith("NotOwner")
                      })
                  })

                  it("updates the price of the item", async function () {
                      const updatedPrice = ethers.utils.parseEther("0.2")
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      expect(
                          await nftMarketplace.updateListing(
                              basicNft.address,
                              TOKEN_ID,
                              updatedPrice
                          )
                      ).to.emit("ItemListed")
                      const listing = await nftMarketplace.getListing(basicNft.address, TOKEN_ID)
                      assert(listing.price.toString() == updatedPrice.toString())
                  })
              })

              describe("withdrawProcess", function () {
                  it("doesn't let 0 proceeds withdrawls", async function () {
                      await expect(nftMarketplace.withdrawProceeds()).to.be.revertedWith(
                          "NoProceeds"
                      )
                  })

                  it("withdraws the proceeds", async function () {
                      await nftMarketplace.listItem(basicNft.address, TOKEN_ID, PRICE)
                      nftMarketplace = nftMarketplace.connect(user)
                      await nftMarketplace.buyItem(basicNft.address, TOKEN_ID, { value: PRICE })
                      nftMarketplace = nftMarketplace.connect(deployer)

                      const deployerProceedsStart = await nftMarketplace.getProceeds(
                          deployer.address
                      )
                      const deployerBalanceStart = await deployer.getBalance()
                      const txResponse = await nftMarketplace.withdrawProceeds()
                      const transactionReceipt = await txResponse.wait(1)
                      const { gasUsed, effectiveGasPrice } = transactionReceipt
                      const gasCost = gasUsed.mul(effectiveGasPrice)
                      const deployerBalanceEnd = await deployer.getBalance()

                      assert(
                          deployerBalanceEnd.add(gasCost).toString() ==
                              deployerProceedsStart.add(deployerBalanceStart).toString()
                      )
                  })
              })
          })
      })
