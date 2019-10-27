import Plugins from "../../src/plugins";
import axios, {AxiosStatic} from "axios";
import MockedFunction = jest.MockedFunction;

describe("Plugins", function () {
    let instance: Plugins;
    let downloadClient: AxiosStatic & jest.Mock;
    beforeEach(function () {
        downloadClient = jest.genMockFromModule("axios");
        instance = new Plugins("", downloadClient, "/plugins");
        (downloadClient.get as MockedFunction<typeof downloadClient.get>).mockImplementation(async (url) => {
            if(url === "/plugins") {
                return {
                    data: [
                        {
                            author: "test",
                            system: "test",
                            version: "1.0.0"
                        }
                    ]
                }
            } else if (url === "/plugins/test/test/1.0.0/") {
                return {
                    data: Buffer.alloc(0)
                };
            } else {
                return {};
            }
        });
    });
    describe("local plugins", function () {
        it("returns an array of locally stored plugins", function () {
            expect(instance.getLocalPluginDescriptions()).resolves.toEqual([]);
        });
    });
    describe("remote plugins", function () {
        it("can get the list of remote plugins", function () {
            expect(instance.getRemotePluginDescriptions()).resolves.toEqual([{
                author: "test",
                system: "test",
                version: "1.0.0"
            }]);
            expect(downloadClient.get).toHaveBeenCalled();
        });
        it("can download remote plugins to local cache", function () {
            expect(instance.getRemotePluginDescriptions()).resolves.toEqual([{
                author: "test",
                system: "test",
                version: "1.0.0"
            }]);
        });
        it("keeps a temporary cache of plugins after download", async function () {
            await expect(instance.getRemotePluginDescriptions()).resolves.toEqual([{
                author: "test",
                system: "test",
                version: "1.0.0"
            }]);
            await expect(instance.getRemotePluginDescriptions()).resolves.toEqual([{
                author: "test",
                system: "test",
                version: "1.0.0"
            }]);
            expect(downloadClient.get).toHaveBeenCalledTimes(1);
        });
        it("can download remote plugins", async function(){
            await expect(instance.updateLocalPluginCache()).resolves.toEqual([{
                author: "test",
                system: "test",
                version: "1.0.0"
            }]);
            expect(downloadClient.get).toHaveBeenNthCalledWith(1, "/plugins");
            expect(downloadClient.get).toHaveBeenNthCalledWith(2, "/plugins/test/test/1.0.0/");
        });
    })
});