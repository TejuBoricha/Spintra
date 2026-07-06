window.e2eRoomClicked = false;
document.addEventListener("click", function (e) {
  var btn = e.target;
  if (
    btn &&
    (btn.getAttribute("data-testid") === "create-room-button" ||
      btn.closest('[data-testid="create-room-button"]'))
  ) {
    window.e2eRoomClicked = true;
  }
});
