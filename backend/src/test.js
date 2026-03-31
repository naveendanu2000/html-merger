// Subject: ChatRoom
class ChatRoom {
  constructor() {
    this.subscribers = [];
  }

  subscribe(observer) {
    this.subscribers.push(observer);
  }

  unsubscribe(observer) {
    this.subscribers = this.subscribers.filter(sub => sub !== observer);
  }

  notify(message) {
    this.subscribers.forEach(subscriber => subscriber.update(message));
  }

  receiveMessage(message) {
    console.log(`ChatRoom received: ${message}`);
    this.notify(message); // notify all observers
  }
}

// Observer interface
class Observer {
  update(message) {
    throw new Error("Method 'update()' must be implemented");
  }
}

// Concrete observers
class MessageDisplay extends Observer {
  update(message) {
    console.log(`Displaying message: ${message}`);
  }
}

class NotificationSystem extends Observer {
  update(message) {
    console.log(`Sending notification: ${message}`);
  }
}

class MessageCounter extends Observer {
  constructor() {
    super();
    this.count = 0;
  }
  update(message) {
    this.count++;
    console.log(`Total messages: ${this.count}`);
  }
}

// Usage
const chatRoom = new ChatRoom();

const display = new MessageDisplay();
const notifier = new NotificationSystem();
const counter = new MessageCounter();

chatRoom.subscribe(display);
chatRoom.subscribe(notifier);
chatRoom.subscribe(counter);

chatRoom.receiveMessage("Hello Alice!");
chatRoom.receiveMessage("Hello Bob!");