// Handles all indexDB requests

class Database {
    DATABASE = 'SnapDatabase'
    PROJECTS = 'projects'

    constructor () {
        this.request()
    }

    request () {
        console.log('opening database')
        const request = indexedDB.open(this.DATABASE);
        request.onerror = (event) => {
            console.error("Unable to load database");
        };

        request.onupgradeneeded = (event) => {
            console.log('creating database')

            // Save the IDBDatabase interface
            const db = event.target.result;
          
            // Create an objectStore for this database
            const objectStore = db.createObjectStore(this.PROJECTS, { keyPath: "name" });

            objectStore.createIndex("xml", "xml", { unique: false });
        };

        return request
    }

    add (store, data) {
        let request = this.request()

        let promise = new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                console.log('success')
    
                let db = event.target.result;
                
                const transaction = db.transaction([store], "readwrite");
                
                transaction.oncomplete = (event) => {
                    resolve(event.result)
                };
                
                transaction.onerror = (event) => {
                    reject(event.error)
                };
                
                const objectStore = transaction.objectStore(store);
                console.log('data', data)
                const objRequest = objectStore.add(data);
                objRequest.onsuccess = (event) => {
                    // event.target.result === customer.ssn;
                    resolve(event.result)
                };
            };
        })

        return promise
    }

    remove(store, name) {
        let request = this.request()

        let promise = new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                let db = event.target.result;
    
                const removeRequest = db
                    .transaction([store], "readwrite")
                    .objectStore(store)
                    .delete(name);
                removeRequest.onsuccess = (event) => {
                    resolve(event.result)
                };

                removeRequest.onerror = (event) => {
                    reject(event.error)
                }
            }
        })

        return promise
    }

    get(store, name) {
        let request = this.request()

        const promise = new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                let db = event.target.result;
    
                const transaction = db.transaction([store]);
                const objectStore = transaction.objectStore(store);
                const getRequest = objectStore.get(name);
                getRequest.onerror = (event) => {
                    reject(event.error)
                };
                getRequest.onsuccess = (event) => {
                    // Do something with the request.result!
                    resolve(event.target.result)
                };
            }
        })

        return promise
    }

    getAll(store) {
        let request = this.request()

        let promise = new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                let db = event.target.result;
    
                const objectStore = db
                    .transaction([store], "readwrite")
                    .objectStore(store);
                
                let getAllRequest = objectStore.getAll()
                getAllRequest.onsuccess = (event) => {
                    resolve(event.target.result)
                };
                getAllRequest.onerror = (event) => {
                    reject(event.target.result)
                }
            }
        })

        return promise
    }

    update(store, name, data) {
        let request = this.request()

        let promise = new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                let db = event.target.result;

                const objectStore = db
                    .transaction([store], "readwrite")
                    .objectStore(store);
                const updateRequest = objectStore.get(name);
                updateRequest.onerror = (event) => {
                    reject(event.error)
                };
                updateRequest.onsuccess = (event) => {
                    const requestUpdate = objectStore.put(data);
                    requestUpdate.onerror = (event) => {
                        reject(event.error)
                    };
                    requestUpdate.onsuccess = (event) => {
                        resolve(event.result)
                    };
                };
            }
        })

        return promise
    }

    cursor(store, callback) {
        let request = this.request()

        request.onsuccess = (event) => {
            let db = event.target.result;
            
            const objectStore = db.transaction(store).objectStore(store);

            objectStore.openCursor().onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    callback(cursor)
                    cursor.continue();
                } else {
                    console.log("No more entries!");
                }
            };
        }
    }

    addProject(name, xml) {
        return this.add(this.PROJECTS, {name: name, xml: xml})
    }

    saveProject(name, xml) {
        let promise = new Promise((resolve, reject) => {
            this.getProject(name)
                .then((result) => {
                    console.log(result)
                    if (result === undefined) {
                        console.log('add project', name)
                        this.add(this.PROJECTS, {name: name, xml: xml}).then((result) => {
                            resolve(result)
                        })
                    } else {
                        console.log('update project', name)
                        this.update(this.PROJECTS, name, {name: name, xml: xml}).then((result) => {
                            resolve(result)
                        })
                    }
                })
        })

        return promise
    }

    getProject(name) {
        return this.get(this.PROJECTS, name)
    }

    getAllProjects() {
        return this.getAll(this.PROJECTS)
    }

    deleteProject(name) {
        return this.remove(this.PROJECTS, name)
    }
}
